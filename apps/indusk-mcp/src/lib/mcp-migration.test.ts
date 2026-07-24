import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removeLegacyMcpServers } from "./mcp-migration.js";

/**
 * A19 (indusk-makeover Phase 8 cleanup): init and update share ONE
 * legacy-MCP-removal implementation. Covers remove-success + remove-failure
 * via runner injection, and pins call-site parity — neither command file may
 * carry its own removal loop.
 */

describe("removeLegacyMcpServers (A19)", () => {
	let projectRoot: string;

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-mcp-migration-"));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	it("removes every registered legacy server via `claude mcp remove`", () => {
		writeFileSync(
			join(projectRoot, ".mcp.json"),
			JSON.stringify({ mcpServers: { indusk: {}, graphiti: {}, codegraphcontext: {} } }),
		);
		const commands: string[] = [];
		const result = removeLegacyMcpServers(projectRoot, { run: (c) => void commands.push(c) });

		expect(result.removed.sort()).toEqual(["codegraphcontext", "graphiti"]);
		expect(result.failed).toEqual([]);
		expect(commands).toEqual([
			"claude mcp remove -s project codegraphcontext",
			"claude mcp remove -s project graphiti",
		]);
	});

	it("reports failures without aborting the rest", () => {
		writeFileSync(
			join(projectRoot, ".mcp.json"),
			JSON.stringify({ mcpServers: { graphiti: {}, codegraphcontext: {} } }),
		);
		const result = removeLegacyMcpServers(projectRoot, {
			run: (c) => {
				if (c.includes("graphiti")) throw new Error("boom");
			},
		});

		expect(result.removed).toEqual(["codegraphcontext"]);
		expect(result.failed).toEqual(["graphiti"]);
	});

	it("no .mcp.json / unparseable .mcp.json → empty result, no throw", () => {
		expect(removeLegacyMcpServers(projectRoot)).toEqual({ removed: [], failed: [] });
		writeFileSync(join(projectRoot, ".mcp.json"), "{not json");
		expect(removeLegacyMcpServers(projectRoot)).toEqual({ removed: [], failed: [] });
	});

	it("skips servers not present in .mcp.json (idempotent on clean projects)", () => {
		writeFileSync(join(projectRoot, ".mcp.json"), JSON.stringify({ mcpServers: { indusk: {} } }));
		const commands: string[] = [];
		const result = removeLegacyMcpServers(projectRoot, { run: (c) => void commands.push(c) });
		expect(result).toEqual({ removed: [], failed: [] });
		expect(commands).toEqual([]);
	});

	it("call-site parity: init.ts and update.ts use the helper, not hand-rolled loops", () => {
		const here = dirname(fileURLToPath(import.meta.url));
		for (const file of ["../bin/commands/init.ts", "../bin/commands/update.ts"]) {
			const source = readFileSync(join(here, file), "utf-8");
			expect(source, `${file} should call the shared helper`).toMatch(/removeLegacyMcpServers\(/);
			expect(source, `${file} must not hand-roll a legacy removal loop`).not.toMatch(
				/claude mcp remove -s project \$\{legacy\}/,
			);
		}
	});
});
