import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { gateTransition, validateWrite } from "./helpers/hook-runner.js";

/**
 * A13, A17 — the phase heading gets one definition, and "no phases" becomes a
 * refusal.
 *
 * These two belong together because the second is what makes the first safe to
 * do. Changing what a heading looks like across seven copies is risky; changing
 * it in one place while "nothing parsed" silently passes is worse, because a
 * typo in the new syntax would disable every structural rule at once instead of
 * failing loudly.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every `.ts` file under `src/`, tests and test support excluded. */
async function sourceFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "__tests__" || entry.name === "node_modules") continue;
			out.push(...(await sourceFiles(full)));
			continue;
		}
		if (!entry.name.endsWith(".ts")) continue;
		if (entry.name.includes(".test.") || entry.name.includes(".test-support.")) continue;
		out.push(full);
	}
	return out;
}

async function filesMatching(pattern: RegExp): Promise<string[]> {
	const hits: string[] = [];
	for (const file of await sourceFiles(srcDir)) {
		if (pattern.test(await readFile(file, "utf8"))) hits.push(file);
	}
	return hits;
}

describe("A13 — one definition of the phase heading", () => {
	it("is defined exactly once across src/", async () => {
		// Seven copies across six files today: impl-parser.ts, check-gates.js,
		// gate-reminder.js, validate-impl-structure.js (x2), trajectory/validator.ts
		// and shape/impl-blocks.ts. The JS hooks are deliberate ports and live
		// outside src/, so this scan covers src/ only — the same carve-out the
		// verify suite makes for its hook mirrors.
		const definitions = await filesMatching(/###\\s\+\(\?:Build|###\\s\+Phase/);

		expect(definitions).toHaveLength(1);
	});

	// A behavioural companion — "the one definition accepts both spellings and
	// rejects a test phase" — is deliberately NOT authored here. It imports
	// `lib/impl-headings.js`, which Phase 1 creates, so at Phase 0 it fails to
	// load and its assertion never runs: a fake red, and exactly what this plan
	// forbids. It is written in Phase 1 alongside the module, which is the
	// legitimate `Writable at = Passes at` case (the subject is a symbol
	// introduced in that phase).
});

describe("A17 — an impl in which no phase parses is refused, not passed", () => {
	// The hazard is not a malformed file sitting on disk; it is a malformed file
	// arriving as an *edit that checks a box*. Every structural rule is keyed on
	// parsed phases, so when zero phases parse there is nothing to enforce
	// against and the write sails through — the typo does not fail, it disables.
	// `Bulid` is the plausible version of that typo under this plan's new syntax.
	const FRONTMATTER = [
		"---",
		'title: "Broken"',
		"status: in-progress",
		"trajectory: required",
		"gate_policy: auto",
		"---",
		"",
		"# Broken",
		"",
		"## Test Trajectory",
		"",
		"| ID | Asserts | Writable at | Passes at | State |",
		"|----|---------|-------------|-----------|-------|",
		"| T1 | a thing is true | Phase 0 | Phase 1 | passing |",
		"",
		"## Checklist",
		"",
	].join("\n");

	const VALID_ON_DISK = `${FRONTMATTER}${[
		"### Phase 1: Thing",
		"",
		"- [ ] do the thing",
		"",
		"#### Phase 1 Verification",
		"- [ ] T1 passes",
		"",
	].join("\n")}`;

	const TYPO_WITH_CHECKOFF = `${FRONTMATTER}${[
		"### Bulid Phase 1: Thing",
		"",
		"- [x] do the thing",
		"",
		"#### Phase 1 Verification",
		"- [ ] T1 passes",
		"",
	].join("\n")}`;

	it("validate-impl-structure refuses it", async () => {
		const result = await validateWrite(TYPO_WITH_CHECKOFF);

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr.toLowerCase()).toMatch(/phase/);
	}, 30_000);

	it("check-gates refuses it", async () => {
		const result = await gateTransition(VALID_ON_DISK, TYPO_WITH_CHECKOFF);

		expect(result.exitCode).not.toBe(0);
	}, 30_000);
});
