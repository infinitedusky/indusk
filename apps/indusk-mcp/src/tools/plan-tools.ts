import { existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlanningDir } from "../lib/config.js";
import { getAllPhaseCompletions, parseImpl } from "../lib/impl-parser.js";
import { isFinishedDocumentStatus, nextRequiredDocument } from "../lib/lifecycle.js";
import { type PlanSummary, parseAllPlans, parsePlan } from "../lib/plan-parser.js";
import { ARCHIVE_DIR, archivedInMotion, archivedPlan } from "../lib/promises/after-close.js";
import { confirmPlan } from "../lib/promises/confirm.js";
import { promiseHealth } from "../lib/promises/health.js";
import { WatcherBlind } from "../lib/promises/probe.js";
import { readPromises } from "../lib/promises/registry.js";
import { openMaintenancePhasesIn } from "../lib/promises/reopen.js";
import {
	changePromise,
	declarePromise,
	PromiseWriteRefused,
	replacePromise,
} from "../lib/promises/write.js";
import { DOCUMENT_LABELS } from "../lib/workflow-types.js";
import {
	copySource,
	livePlanCopy,
	type PlanCopy,
	resolvePlanCopies,
} from "../lib/worktree/plan-worktrees.js";
import { isRootsRefusal, resolveExecutionRoots } from "../lib/worktree/roots.js";

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

	/** A registry write as a tool result: what was written, or the refusal as an error. JSON, as every tool here returns. */
	const written = (run: () => Record<string, unknown>) => {
		const text = (value: unknown) => [
			{ type: "text" as const, text: JSON.stringify(value, null, 2) },
		];
		try {
			return { content: text(run()) };
		} catch (err) {
			if (!(err instanceof PromiseWriteRefused)) throw err;
			return { isError: true, content: text({ error: err.message }) };
		}
	};
	const promiseFields = {
		plan: z.string().describe("The plan making the promise: a folder under .indusk/planning/."),
		kind: z
			.string()
			.describe(
				"behaviour (breaks on inputs nobody chose; watched in the running system), state (breaks on a later change; a test), or structure (breaks when something is removed or duplicated; a build-time check). Assign it from the sentence; the person can correct it.",
			),
		domain: z.string().describe("One of the project's declared domains (promises.domains)."),
		statement: z.string().describe("The promise in one plain sentence, as the person approved it."),
	};

	server.registerTool(
		"declare_promise",
		{
			description:
				"Write a promise from a planning conversation into the registry: `declared`, owned by the plan, with the sentence the person approved. Call it once the person has confirmed the sentence — never write a registry file by hand. A project that declares no domains gets this promise's domain declared. Refuses, with nothing written, a name the registry already holds (use change_promise), a plan that is not an open plan folder, or a domain the project does not declare.",
			inputSchema: {
				name: z.string().describe("kebab-case, starting with a letter; it becomes the file name."),
				...promiseFields,
			},
		},
		async ({ name, plan, kind, domain, statement }) =>
			written(() => {
				declarePromise(projectRoot, { name, plan, kind, domain, statement });
				return { declared: name, owner: plan, state: "declared" };
			}),
	);

	server.registerTool(
		"change_promise",
		{
			description:
				"Improve an existing promise in place when a plan partly changes what it commits to: its sentence is replaced, the plan takes it over, and its History keeps the old sentence, the reason and the plan that owned it before. Its name, state, incidents and the marks that name it are untouched. Use replace_promise instead when the name no longer describes it.",
			inputSchema: {
				name: z.string().describe("The promise to change."),
				plan: z.string().describe("The plan changing it."),
				statement: z.string().describe("The promise as it now reads, in one plain sentence."),
				reason: z.string().describe("Why it changed, in a sentence."),
			},
		},
		async ({ name, plan, statement, reason }) =>
			written(() => {
				const before = readPromises(projectRoot);
				const was = before.ok ? before.registry.promises.find((p) => p.name === name) : undefined;
				changePromise(projectRoot, { name, plan, statement, reason });
				return { changed: name, owner: plan, previousOwner: was?.owner ?? null };
			}),
	);

	server.registerTool(
		"replace_promise",
		{
			description:
				"Replace a promise whose name no longer describes it: declares the new promise recording which it replaces. The old one stays in force until the plan closes, when it is retired.",
			inputSchema: {
				old: z.string().describe("The promise being replaced."),
				name: z.string().describe("The new promise's name."),
				...promiseFields,
			},
		},
		async ({ old, name, plan, kind, domain, statement }) =>
			written(() => {
				replacePromise(projectRoot, { old, name, plan, kind, domain, statement });
				return { declared: name, owner: plan, supersedes: old, retiredAt: "the plan's close" };
			}),
	);

	server.registerTool(
		"confirm_promises",
		{
			description:
				"Close a plan's promises, before the retrospective archives it: each promise the plan declared becomes enforced, with the test files its rows name and the code that carries its token, and a promise it replaces is retired. Refuses, naming each promise, when no passing row names it, a test file its row names is missing or does not carry its token, or no code carries it — and then writes nothing.",
			inputSchema: {
				plan: z.string().describe("The plan closing: a folder under .indusk/planning/."),
				code_root: z
					.string()
					.optional()
					.describe(
						"Where the plan's code and tests are. Defaults to the project's code root; in a workbench before landing, pass the plan's own worktree.",
					),
			},
		},
		async ({ plan, code_root }) => {
			const text = (value: unknown, isError = false) => ({
				...(isError ? { isError: true } : {}),
				content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
			});
			let codeRoot = code_root;
			if (codeRoot === undefined) {
				const roots = resolveExecutionRoots(projectRoot);
				if (isRootsRefusal(roots)) return text({ error: roots.error }, true);
				codeRoot = roots.codeRoot;
			}
			const result = await confirmPlan({ planRoot: projectRoot, codeRoot, plan });
			if (!result.ok) {
				return text({ refusals: result.refusals, written: result.written }, true);
			}
			return text({ plan, confirmed: result.confirmed });
		},
	);

	server.registerTool(
		"promise_health",
		{
			description:
				"What the promises are doing right now: per behaviour promise, violations in the window, open incidents, and — the number that matters — violations no incident records yet. Ask this when answering what to work on next; unrecorded violations outrank the roadmap. Reads every source — `local` (the daemon) and, when the project names one, `production` (its always-on server) — through the same reads the CLI uses, so the two cannot disagree. `sources` holds each source's rows or its failure; the top-level fields are the alarm source's (production when there is one), so a local break during development is shown under `sources` without being raised. Errors only when no source can be read.",
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
							text: JSON.stringify(
								{
									error: (err as Error).message,
									// A watcher that answered and did not hear is its own
									// state, so a session can say so rather than "unreachable".
									...(err instanceof WatcherBlind ? { blind: true } : {}),
									promises: null,
								},
								null,
								2,
							),
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

			// Brief or test plan → the next document: the status must be
			// "accepted". Which document is next is the plan's own next step,
			// which knows the declared type — this named the ADR for every plan,
			// including the bugfix whose type skips it (admin-plan-type, A25).
			if (plan.stage === "brief" || plan.stage === "test-plan") {
				const next = nextRequiredDocument(plan.stage, plan.workflow ?? null);
				const transition = `${plan.stage} → ${next ?? "done"}`;
				if (plan.stageStatus === "accepted") {
					return respond({ allowed: true, transition, nextStage: plan.nextStep });
				}
				const label = DOCUMENT_LABELS[plan.stage];
				const noun = label.charAt(0).toUpperCase() + label.slice(1);
				return respond({
					allowed: false,
					transition,
					missing: [`${noun} status is '${plan.stageStatus}', must be 'accepted'`],
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
			if (isFinishedDocumentStatus(plan.stageStatus)) {
				return respond({ allowed: true, nextStage: plan.nextStep });
			}

			return respond({
				allowed: false,
				missing: [
					`${plan.stage} status is '${plan.stageStatus}', needs 'accepted', 'complete' or 'completed'`,
				],
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
