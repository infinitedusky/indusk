import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * workbench-trust-fixes A18 — no active plan waits on a tool that no longer
 * exists.
 *
 * `workbench-mode-rail-integrity`'s U1 blocker names
 * `mcp__graphiti__get_episodes` as its acceptance criterion. indusk-makeover
 * deleted Graphiti in July. A plan whose close depends on a deleted tool can
 * neither close nor be worked, and nothing said so. Archived plans are the
 * record and are exempt.
 */

const PLANNING = resolve(new URL("../../../../.indusk/planning", import.meta.url).pathname);
const DELETED_TOOLS = /mcp__(graphiti|codegraphcontext)__\w+/g;

describe("A18 — active plans do not reference deleted MCP tools", () => {
	it("every active impl.md is free of graphiti / codegraphcontext tool names", () => {
		const offenders: string[] = [];
		for (const entry of readdirSync(PLANNING, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name === "archive") continue;
			const impl = join(PLANNING, entry.name, "impl.md");
			if (!existsSync(impl)) continue;
			const hits = [...new Set(readFileSync(impl, "utf-8").match(DELETED_TOOLS) ?? [])];
			if (hits.length > 0) offenders.push(`${entry.name}: ${hits.join(", ")}`);
		}
		expect(offenders, `active plans naming deleted tools:\n  ${offenders.join("\n  ")}`).toEqual(
			[],
		);
	});
});
