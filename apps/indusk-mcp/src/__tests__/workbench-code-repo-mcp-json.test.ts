// promise: a-clone-without-an-mcp-config-gets-the-keep-list
//
// a-new-project-starts-instrumented, Test Phase 1: T21 - a workbench's declared code repo
// gets an `.mcp.json` naming the `indusk` server from `init` and `update`, the way a
// checkout does, so the evaluator that runs in the repo can score its first commit; and
// one that already exists is never rewritten. Run through the built CLI on a workbench
// made the way init-workbench.test.ts makes one.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const REPO = "homework-gate";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function bench() {
	const root = mkdtempSync(join(tmpdir(), "workbench-code-repo-mcp-json-"));
	made.push(root);
	const repo = join(root, REPO);
	const workbench = join(root, `${REPO}-workbench`);
	mkdirSync(repo, { recursive: true });
	mkdirSync(workbench, { recursive: true });
	git(repo, ["init", "-q", "-b", "main"]);
	writeFileSync(join(repo, "README.md"), "# app\n");
	writeFileSync(join(repo, "package.json"), JSON.stringify({ name: REPO, version: "0.0.0" }));
	git(repo, ["add", "-A"]);
	git(repo, ["commit", "-q", "-m", "initial"]);
	writeFileSync(
		join(workbench, "package.json"),
		JSON.stringify({ name: `${REPO}-workbench`, version: "0.0.0", private: true }),
	);
	const env = { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1", INDUSK_HOME: join(root, "home") };
	const init = () =>
		runCli(
			workbench,
			["init", "--workbench", "--wrapped-repo", REPO, "--sibling-parent", root, "--no-index"],
			env,
		);
	const update = () => runCli(workbench, ["update"], env);
	return { repo, init, update };
}

describe.skipIf(SHOULD_SKIP)("workbench-code-repo-mcp-json", () => {
	it("T21: init writes the code repo an .mcp.json naming the indusk server", () => {
		const b = bench();
		const r = b.init();
		expect(r.code, `init exit\n${r.stderr}`).toBe(0);

		const file = join(b.repo, ".mcp.json");
		expect(existsSync(file), "the code repo has an .mcp.json").toBe(true);
		const config = JSON.parse(readFileSync(file, "utf-8"));
		expect(Object.keys(config.mcpServers ?? {})).toContain("indusk");
	});

	it("T21: update gives a code repo that has none an .mcp.json naming the indusk server", () => {
		const b = bench();
		expect(b.init().code).toBe(0);
		rmSync(join(b.repo, ".mcp.json"), { force: true });

		const r = b.update();
		expect(r.code, `update exit\n${r.stderr}`).toBe(0);
		const file = join(b.repo, ".mcp.json");
		expect(existsSync(file), "update wrote the code repo an .mcp.json").toBe(true);
		expect(Object.keys(JSON.parse(readFileSync(file, "utf-8")).mcpServers ?? {})).toContain(
			"indusk",
		);
	});

	it("T21: an .mcp.json the code repo already has is byte for byte the same after init and update", () => {
		const b = bench();
		const mine = `${JSON.stringify({ mcpServers: { mine: { command: "mine" } } }, null, 2)}\n`;
		writeFileSync(join(b.repo, ".mcp.json"), mine);

		expect(b.init().code).toBe(0);
		expect(readFileSync(join(b.repo, ".mcp.json"), "utf-8"), "init left it").toBe(mine);
		expect(b.update().code).toBe(0);
		expect(readFileSync(join(b.repo, ".mcp.json"), "utf-8"), "update left it").toBe(mine);
	});
});
