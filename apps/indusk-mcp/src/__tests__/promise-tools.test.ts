import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";
import { registerPlanTools } from "../tools/plan-tools.js";

/**
 * planner-promises A44 — the promise tools move to their own module, and the
 * server offers exactly what it offered before. A refactor guard: the plan
 * tools held seven promise tools beside four plan tools; every other domain
 * has its own tools file.
 *
 * The promise tools' module is loaded by a computed specifier: it does not
 * exist until Build Phase 10 makes it, and a static import of a missing file
 * would fail this whole file to load rather than fail its assertion.
 */

const PLAN_TOOLS = ["list_plans", "get_plan_status", "advance_plan", "order_plans"];
const PROMISE_TOOLS = [
	"list_promises",
	"declare_promise",
	"change_promise",
	"replace_promise",
	"withdraw_promise",
	"confirm_promises",
	"promise_health",
	// incident-recording: catchup's recorder, through the one writer.
	"record_breaks",
];

type Register = (server: McpServer, projectRoot: string) => void;

/** The names a `register*Tools` function registers, in order. */
function names(register: Register): string[] {
	const out: string[] = [];
	const stub = { registerTool: (name: string) => out.push(name) };
	register(stub as unknown as McpServer, "/nonexistent");
	return out;
}

async function loadPromiseTools(): Promise<Register | null> {
	const specifier = ["..", "tools", "promise-tools.js"].join("/");
	try {
		const mod = (await import(/* @vite-ignore */ specifier)) as {
			registerPromiseTools?: Register;
		};
		return mod.registerPromiseTools ?? null;
	} catch {
		return null;
	}
}

describe("planner-promises A44 — the promise tools have their own module", () => {
	it("the plan tools are the plan tools, and the promise tools' module registers the eight", async () => {
		expect(names(registerPlanTools)).toEqual(PLAN_TOOLS);
		const registerPromiseTools = await loadPromiseTools();
		expect(
			registerPromiseTools,
			"tools/promise-tools.ts exports registerPromiseTools",
		).not.toBeNull();
		expect(names(registerPromiseTools as Register)).toEqual(PROMISE_TOOLS);
	});

	it("together they offer exactly the plan tools and the promise tools, nothing lost in the move", async () => {
		const registerPromiseTools = (await loadPromiseTools()) ?? (() => {});
		const all = [...names(registerPlanTools), ...names(registerPromiseTools)].sort();
		expect(all).toEqual([...PLAN_TOOLS, ...PROMISE_TOOLS].sort());
	});
});
