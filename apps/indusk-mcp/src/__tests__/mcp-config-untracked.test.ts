// promise: the-mcp-config-is-not-tracked
//
// untrack-mcp-json T1, T2: this repository does not version a machine's MCP
// config, and the ignore rule that says so holds. Reads this repository's own
// git state.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertJaegerEntry } from "../lib/mcp-config.js";
import { git, REPO_ROOT } from "./helpers/cli.js";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("the MCP config is not versioned", () => {
	it("T1: git does not track .mcp.json in this repository", () => {
		const tracked = git(REPO_ROOT, ["ls-files", "--", ".mcp.json"]).stdout.trim();
		expect(tracked, "`git ls-files .mcp.json` lists the file").toBe("");
	});

	it("T2: git reports .mcp.json as ignored, so a regenerated copy shows up as nothing", () => {
		const r = git(REPO_ROOT, ["check-ignore", "-q", ".mcp.json"]);
		expect(r.code, "`git check-ignore .mcp.json` exits 0 when the file is ignored").toBe(0);
	});

	it("T6: syncing a new jaeger port leaves git status clean where .mcp.json is ignored and untracked", () => {
		const dir = mkdtempSync(join(tmpdir(), "mcp-config-sync-"));
		made.push(dir);
		git(dir, ["init", "-q"]);
		writeFileSync(join(dir, ".gitignore"), ".mcp.json\n");
		git(dir, ["add", ".gitignore"]);
		git(dir, ["commit", "-qm", "init"]);
		writeFileSync(
			join(dir, ".mcp.json"),
			`${JSON.stringify({ mcpServers: { jaeger: { type: "http", url: "http://localhost:1/mcp" } } })}\n`,
		);

		upsertJaegerEntry(dir, 60734);

		expect(git(dir, ["status", "--short"]).stdout.trim(), "git status lists nothing").toBe("");
	});
});
