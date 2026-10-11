// promise: the-mcp-config-is-not-tracked
//
// untrack-mcp-json T1, T2: this repository does not version a machine's MCP
// config, and the ignore rule that says so holds. Reads this repository's own
// git state.
import { describe, expect, it } from "vitest";
import { git, REPO_ROOT } from "./helpers/cli.js";

describe("the MCP config is not versioned", () => {
	it("T1: git does not track .mcp.json in this repository", () => {
		const tracked = git(REPO_ROOT, ["ls-files", "--", ".mcp.json"]).stdout.trim();
		expect(tracked, "`git ls-files .mcp.json` lists the file").toBe("");
	});

	it("T2: git reports .mcp.json as ignored, so a regenerated copy shows up as nothing", () => {
		const r = git(REPO_ROOT, ["check-ignore", "-q", ".mcp.json"]);
		expect(r.code, "`git check-ignore .mcp.json` exits 0 when the file is ignored").toBe(0);
	});
});
