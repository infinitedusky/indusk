import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * test-kinds A19 — the planner's impl template does not offer the whole suite
 * as a phase's verification. A phase runs its own trajectory rows and the
 * tests related to the files it changed; `pnpm test` and `pnpm test:system`
 * run at landing. A template that says `e.g. pnpm test` teaches every new plan
 * to wait for the suite at every phase.
 */

describe("test-kinds A19 — the impl template's Verification example", () => {
	it("names the phase's rows and related tests, not the whole suite", () => {
		const planner = readFileSync(join(REPO_ROOT, "apps/indusk-mcp/skills/planner.md"), "utf-8");
		const offending = planner
			.split("\n")
			.map((text, i) => ({ line: i + 1, text }))
			.filter(({ text }) => /^\s*- \[ \].*\bpasses\b.*\bpnpm test\b/.test(text));
		expect(
			offending,
			`The impl template offers the whole suite as a phase's verification:\n${offending.map((o) => `  skills/planner.md:${o.line} ${o.text.trim()}`).join("\n")}`,
		).toEqual([]);
		expect(planner, "the template names related tests instead").toMatch(/vitest related/);
	});
});
