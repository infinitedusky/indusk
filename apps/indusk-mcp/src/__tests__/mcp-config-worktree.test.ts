// promise: a-clone-without-an-mcp-config-gets-the-keep-list
//
// untrack-mcp-json T8: a plan worktree is a checkout, and the MCP config is no
// longer versioned, so git does not carry it there. `createPlanWorktree` (behind
// `plans start` and `worktree create`) has to.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPlanWorktree } from "../lib/worktree/plan-worktree-commands.js";
import {
	PLAN,
	type PlanWorktreeProject,
	planWorktreeProject,
} from "./helpers/plan-worktree-fixture.js";

let project: PlanWorktreeProject | undefined;
afterEach(() => {
	project?.cleanup();
	project = undefined;
});

describe("a new plan worktree and the MCP config", () => {
	it("T8: a worktree made from a checkout that has a .mcp.json has one too, with the same servers", async () => {
		project = planWorktreeProject("mcp-config-wt");
		const config = {
			mcpServers: {
				indusk: { type: "stdio", command: "indusk", args: ["serve"], env: { PROJECT_ROOT: "." } },
				jaeger: { type: "http", url: "http://localhost:60734/mcp" },
				mine: { type: "http", url: "http://localhost:9/mcp" },
			},
		};
		writeFileSync(join(project.trunk, ".mcp.json"), `${JSON.stringify(config, null, 2)}\n`);

		const { created } = await createPlanWorktree(project.trunk, PLAN);

		const file = join(created, ".mcp.json");
		expect(existsSync(file), ".mcp.json exists in the new worktree").toBe(true);
		expect(JSON.parse(readFileSync(file, "utf-8"))).toEqual(config);
	});
});
