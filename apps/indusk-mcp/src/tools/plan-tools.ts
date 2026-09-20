import { existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlanningDir } from "../lib/config.js";
import { getAllPhaseCompletions, parseImpl } from "../lib/impl-parser.js";
import { type PlanSummary, parseAllPlans, parsePlan } from "../lib/plan-parser.js";
import { ARCHIVE_DIR, archivedInMotion, archivedPlan } from "../lib/promises/after-close.js";
import { promiseHealth } from "../lib/promises/health.js";
import { readPromises } from "../lib/promises/registry.js";
import { openMaintenancePhasesIn } from "../lib/promises/reopen.js";
import {
	copySource,
	livePlanCopy,
	type PlanCopy,
	resolvePlanCopies,
} from "../lib/worktree/plan-worktrees.js";

/** An unreadable assignment record, as every plan tool reports it: an error naming the file, never a guessed copy. */
function recordError(file: string, problem: string) {
	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(
					{
						error: `the plan-worktree assignment record cannot be read: ${problem} — fix or remove it (indusk worktree assign/release rewrite it)`,
						file,
					},
					null,
					2,
				),
			},
		],
		isError: true,
	};
}

/** `parsePlan`, or an `unknown` summary when the folder does not exist (it throws). */
function parsePlanIfPresent(dir: string): PlanSummary {
	if (existsSync(dir)) return parsePlan(dir);
	return {
		name: dir.split("/").pop() ?? "",
		stage: "unknown",
		stageStatus: "missing",
		nextStep: `No plan folder at ${dir}`,
		dependencies: [],
		documents: [],
	};
}

/** The plan folder a copy names — the resolver's, checked on disk; never joined here. */
function planDirOf(copy: PlanCopy): string {
	return copy.dir;
}

export function registerPlanTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"list_plans",
		{
			description:
				"List plans in the planning/ directory with their stage, status, next step, and dependencies. Pass active: true (the catchup default — indusk-makeover diet) to return only genuinely in-motion plans (any doc accepted/approved/in-progress) instead of every draft.",
			inputSchema: {
				active: z
					.boolean()
					.optional()
					.describe(
						"When true, return only active plans — stage status is accepted/approved/in-progress/proposed/completed (completed = awaiting close-out rituals). Dead drafts and finished spikes are omitted (with a count).",
					),
			},
		},
		async ({ active }) => {
			// The inventory is the main working tree's, whichever checkout the
			// server runs in; an assigned plan is re-read from its worktree.
			const resolved = await resolvePlanCopies(projectRoot);
			if (!resolved.ok) return recordError(resolved.file, resolved.problem);
			const plans: PlanSummary[] = parseAllPlans(resolved.projectRoot).map((plan) => {
				const copy = resolved.copies.get(plan.name);
				const live = copy?.source === "worktree" ? parsePlan(planDirOf(copy)) : plan;
				// An incident's open Maintenance phase, read from the live copy
				// (day-monitor A29) — archived plans report theirs the same way.
				const dir = copy ? planDirOf(copy) : join(getPlanningDir(resolved.projectRoot), plan.name);
				const reopened = openMaintenancePhasesIn(dir);
				return { ...live, ...copySource(copy), ...(reopened.length > 0 ? { reopened } : {}) };
			});
			// Archived plans back in motion (day-monitor): reopened by an
			// incident. The archive folder itself is not a plan.
			const listed = new Set(plans.map((p) => p.name));
			for (const p of archivedInMotion(resolved.projectRoot)) {
				if (!listed.has(p.name)) plans.push(p);
			}
			const inventory = plans.filter((p) => p.name !== ARCHIVE_DIR);
			if (!active) {
				return {
					content: [{ type: "text" as const, text: JSON.stringify(inventory, null, 2) }],
				};
			}
			const filtered = inventory.filter((p) => isActivePlan(p));
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								active: filtered,
								omitted: inventory.length - filtered.length,
								note: "omitted = dead drafts and finished spikes; call without `active` for the full list",
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"list_promises",
		{
			description:
				"The promise registry (.indusk/promises/): every promise with its kind, lifetime, state, domain, owner, statement and links, plus every incident — or, when the registry is missing or an entry is malformed, the problem naming the file and the field. No filtering; read it the way /catchup reads plans.",
			inputSchema: {},
		},
		async () => {
			const read = readPromises(projectRoot);
			const text = JSON.stringify(read, null, 2);
			return { content: [{ type: "text" as const, text }] };
		},
	);

	server.registerTool(
		"promise_health",
		{
			description:
				"What the promises are doing right now: per behaviour promise, violations in the window, open incidents, and — the number that matters — violations no incident records yet. Ask this when answering what to work on next; unrecorded violations outrank the roadmap. Reads the Jaeger the project names (its local daemon, or a deployed always-on server) through the same query the CLI uses, so the two cannot disagree.",
			inputSchema: {
				since_ms: z
					.number()
					.optional()
					.describe("Window in milliseconds; defaults to the project's quiet window."),
			},
		},
		async ({ since_ms }) => {
			try {
				const report = await promiseHealth(projectRoot, {
					...(since_ms !== undefined ? { sinceMs: since_ms } : {}),
				});
				return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
			} catch (err) {
				// Unreachable telemetry is reported, never rendered as zero
				// violations: "nothing is broken" and "nobody could look" are
				// different answers and only one of them is reassuring.
				return {
					isError: true,
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: (err as Error).message, promises: null }, null, 2),
						},
					],
				};
			}
		},
	);

	server.registerTool(
		"get_plan_status",
		{
			description:
				"Get detailed status of a specific plan including phase progress and blocked items",
			inputSchema: { name: z.string().describe("Plan directory name (e.g. 'mcp-dev-system')") },
		},
		async ({ name }) => {
			const live = await livePlanCopy(projectRoot, name);
			if (!live.ok) return recordError(live.file, live.problem);
			let planDir = planDirOf(live.copy);
			let plan: PlanSummary = parsePlanIfPresent(planDir);
			// Not in planning/: an archived plan, judged as one (day-monitor).
			if (plan.stage === "unknown" && !existsSync(planDir)) {
				const archived = archivedPlan(live.copy.root, name);
				if (archived) {
					plan = archived;
					planDir = join(getPlanningDir(live.copy.root), ARCHIVE_DIR, name);
				}
			}

			const implPath = join(planDir, "impl.md");
			const impl = parseImpl(implPath);
			const completions = impl.phases.length > 0 ? getAllPhaseCompletions(impl) : [];

			const result = {
				...plan,
				...copySource(live.copy),
				implStatus: impl.status,
				phases: completions,
			};

			return {
				content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
			};
		},
	);

	server.registerTool(
		"advance_plan",
		{
			description:
				"Validate whether a plan can advance to the next stage. Returns what is missing if blocked.",
			inputSchema: { name: z.string().describe("Plan directory name") },
		},
		async ({ name }) => {
			const live = await livePlanCopy(projectRoot, name);
			if (!live.ok) return recordError(live.file, live.problem);
			const planDir = planDirOf(live.copy);
			const plan = parsePlan(planDir);
			const implPath = join(planDir, "impl.md");
			const impl = parseImpl(implPath);

			const where = copySource(live.copy);
			const respond = (result: object) => ({
				content: [
					{ type: "text" as const, text: JSON.stringify({ ...result, ...where }, null, 2) },
				],
			});

			// Brief → test plan: brief status must be "accepted"
			if (plan.stage === "brief") {
				if (plan.stageStatus === "accepted") {
					return respond({
						allowed: true,
						transition: "brief → test-plan",
						nextStage: "Create test-plan",
					});
				}
				return respond({
					allowed: false,
					transition: "brief → test-plan",
					missing: [`Brief status is '${plan.stageStatus}', must be 'accepted'`],
				});
			}

			// Test plan → ADR: test plan status must be "accepted" (the stage the
			// lifecycle's DOCUMENT_POSITIONS added — admin-ui-phase-progress)
			if (plan.stage === "test-plan") {
				if (plan.stageStatus === "accepted") {
					return respond({ allowed: true, transition: "test-plan → adr", nextStage: "Create adr" });
				}
				return respond({
					allowed: false,
					transition: "test-plan → adr",
					missing: [`Test plan status is '${plan.stageStatus}', must be 'accepted'`],
				});
			}

			// ADR → Impl: ADR status must be "accepted"
			if (plan.stage === "adr") {
				if (plan.stageStatus === "accepted") {
					return respond({ allowed: true, transition: "adr → impl", nextStage: "Create impl" });
				}
				return respond({
					allowed: false,
					transition: "adr → impl",
					missing: [`ADR status is '${plan.stageStatus}', must be 'accepted'`],
				});
			}

			// Impl phases and impl → retrospective
			if (plan.stage === "impl" && impl.phases.length > 0) {
				const completions = getAllPhaseCompletions(impl);
				const currentPhase = completions.find((c) => !c.complete);

				if (currentPhase) {
					const missing: string[] = [];

					// Check for blockers in the current phase
					const phase = impl.phases.find((p) => p.number === currentPhase.phase);
					if (phase?.blocker) {
						missing.push(`[blocker] ${phase.blocker}`);
					}

					for (const [gate, items] of Object.entries(currentPhase.uncheckedByGate)) {
						for (const item of items) {
							missing.push(`[${gate}] ${item}`);
						}
					}
					return respond({
						allowed: false,
						transition: `phase ${currentPhase.phase} → phase ${currentPhase.phase + 1}`,
						currentPhase: currentPhase.phase,
						phaseName: currentPhase.name,
						missing,
					});
				}

				// All phases complete — check impl status for retrospective
				if (impl.status !== "completed") {
					return respond({
						allowed: false,
						transition: "impl → retrospective",
						missing: ["Impl status is not 'completed' — update frontmatter status"],
					});
				}

				return respond({
					allowed: true,
					transition: "impl → retrospective",
					nextStage: "Create retrospective",
				});
			}

			// Research or other stages
			if (plan.stageStatus === "accepted" || plan.stageStatus === "completed") {
				return respond({ allowed: true, nextStage: plan.nextStep });
			}

			return respond({
				allowed: false,
				missing: [`${plan.stage} status is '${plan.stageStatus}', needs 'accepted' or 'completed'`],
			});
		},
	);

	server.registerTool(
		"order_plans",
		{
			description: "Get plan execution order based on dependencies (topological sort)",
		},
		async () => {
			const plans = parseAllPlans(projectRoot);

			// Topological sort via Kahn's algorithm
			const inDegree = new Map<string, number>();
			const adj = new Map<string, string[]>();

			for (const plan of plans) {
				inDegree.set(plan.name, 0);
				adj.set(plan.name, []);
			}

			for (const plan of plans) {
				for (const dep of plan.dependencies) {
					if (adj.has(dep)) {
						adj.get(dep)?.push(plan.name);
						inDegree.set(plan.name, (inDegree.get(plan.name) ?? 0) + 1);
					}
				}
			}

			const queue: string[] = [];
			for (const [name, degree] of inDegree) {
				if (degree === 0) queue.push(name);
			}

			const ordered: string[] = [];
			while (queue.length > 0) {
				const current = queue.shift();
				if (!current) break;
				ordered.push(current);
				for (const neighbor of adj.get(current) ?? []) {
					const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
					inDegree.set(neighbor, newDegree);
					if (newDegree === 0) queue.push(neighbor);
				}
			}

			const plansByName = new Map(plans.map((p) => [p.name, p]));
			const result = ordered.map((name) => {
				const plan = plansByName.get(name);
				return {
					name,
					stage: plan?.stage,
					stageStatus: plan?.stageStatus,
					dependencies: plan?.dependencies ?? [],
				};
			});

			return {
				content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
			};
		},
	);
}

/**
 * Whether a plan's most-advanced-doc status counts as ACTIVE for
 * `list_plans { active: true }`. Includes `completed` — a completed impl
 * still inside planning/ is awaiting close-out rituals (falsify / cleanup /
 * retrospective); only archival removes a plan from the active list
 * (indusk-makeover Phase 7 falsification, A17). `complete` (research-doc
 * terminal status) stays excluded — a finished spike with no further docs
 * is not in-motion work.
 */
export function isActivePlanStatus(status: string): boolean {
	return ACTIVE_PLAN_STATUSES.has(status.toLowerCase());
}

/**
 * A paper-stage plan is in motion while any paper is still a draft or awaits
 * its first publish; every paper published is done, even if one has gone
 * stale since (the next step still says "Publish", the active list does not
 * resurrect a finished plan for a hotfix). Every other stage uses the
 * document-status rule above.
 */
export function isActivePlan(plan: { stage: string; stageStatus?: string }): boolean {
	// A closed plan waiting out its quiet window is still in motion (day-monitor).
	if (plan.stage === "monitor") return true;
	if (plan.stage === "paper") {
		return plan.stageStatus === "draft" || plan.stageStatus === "accepted";
	}
	return isActivePlanStatus(plan.stageStatus ?? "");
}

const ACTIVE_PLAN_STATUSES = new Set([
	"accepted",
	"approved",
	"in-progress",
	"proposed",
	"completed",
]);
