import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAllPhaseCompletions, parseImpl } from "../lib/impl-parser.js";
import { parseAllPlans, parsePlan } from "../lib/plan-parser.js";

export function registerPlanTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"list_plans",
		{
			description:
				"List all plans in the planning/ directory with their stage, status, next step, and dependencies",
		},
		async () => {
			const plans = parseAllPlans(projectRoot);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(plans, null, 2) }],
			};
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
			const planDir = join(projectRoot, "planning", name);
			const plan = parsePlan(planDir);

			const implPath = join(planDir, "impl.md");
			const impl = parseImpl(implPath);
			const completions = impl.phases.length > 0 ? getAllPhaseCompletions(impl) : [];

			const result = {
				...plan,
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
			const planDir = join(projectRoot, "planning", name);
			const plan = parsePlan(planDir);
			const implPath = join(planDir, "impl.md");
			const impl = parseImpl(implPath);

			const respond = (result: object) => ({
				content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
			});

			// Brief → ADR: brief status must be "accepted"
			if (plan.stage === "brief") {
				if (plan.stageStatus === "accepted") {
					return respond({ allowed: true, transition: "brief → adr", nextStage: "Create adr" });
				}
				return respond({
					allowed: false,
					transition: "brief → adr",
					missing: [`Brief status is '${plan.stageStatus}', must be 'accepted'`],
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
