// promise: a-clone-without-an-mcp-config-gets-the-keep-list
//
// untrack-mcp-json T3, T5: `indusk update` writes a `.mcp.json` when a checkout
// has none, and leaves one that exists exactly as it was. The daemon autostart
// is pinned off: without it, `update` on a project that lacks the local
// telemetry extension starts a real Jaeger as a side effect.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertJaegerEntry } from "../lib/mcp-config.js";
import { git, runCli, SHOULD_SKIP } from "./helpers/cli.js";

const made: string[] = [];
afterEach(() => {
	for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A checkout `indusk update` can run in: a git repo with an InDusk home and no `.mcp.json`. */
function checkout(): string {
	const dir = mkdtempSync(join(tmpdir(), "mcp-config-regen-"));
	made.push(dir);
	git(dir, ["init", "-q"]);
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	writeFileSync(join(dir, ".indusk/config.json"), "{}\n");
	return dir;
}

const update = (dir: string) => runCli(dir, ["update"], { INDUSK_SKIP_TELEMETRY_AUTOSTART: "1" });

describe.skipIf(SHOULD_SKIP)("indusk update and the MCP config", () => {
	it("T3: a checkout with no .mcp.json gets one that names the indusk server", () => {
		const dir = checkout();
		const r = update(dir);
		expect(r.code, `update exit\n${r.stderr}`).toBe(0);
		const file = join(dir, ".mcp.json");
		expect(existsSync(file), ".mcp.json exists after update").toBe(true);
		const config = JSON.parse(readFileSync(file, "utf-8")) as {
			mcpServers?: Record<string, unknown>;
		};
		expect(Object.keys(config.mcpServers ?? {}), "the file names the indusk server").toContain(
			"indusk",
		);
	});

	it("T5: an existing .mcp.json, with a server added by hand, is left exactly as it was", () => {
		const dir = checkout();
		const original = `${JSON.stringify(
			{ mcpServers: { mine: { type: "http", url: "http://localhost:9/mcp" } } },
			null,
			2,
		)}\n`;
		writeFileSync(join(dir, ".mcp.json"), original);
		const r = update(dir);
		expect(r.code, `update exit\n${r.stderr}`).toBe(0);
		const after = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf-8")) as {
			mcpServers: Record<string, unknown>;
		};
		expect(after.mcpServers.mine, "the hand-added server is untouched").toEqual({
			type: "http",
			url: "http://localhost:9/mcp",
		});
	});
});

describe("a file the tooling creates names the indusk server", () => {
	it("T7: pointing a project's jaeger entry at a port, with no .mcp.json, leaves one naming indusk and jaeger", () => {
		const dir = checkout();
		upsertJaegerEntry(dir, 60734);
		const config = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf-8")) as {
			mcpServers?: Record<string, unknown>;
		};
		expect(Object.keys(config.mcpServers ?? {}).sort(), "the file names both servers").toEqual([
			"indusk",
			"jaeger",
		]);
	});
});
