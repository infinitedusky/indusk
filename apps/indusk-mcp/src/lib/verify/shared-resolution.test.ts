import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A24, A25 (dawn-verify cleanup) — one definition per shared rule.
 *
 * These are structural, not behavioral, and that is the point. Both rules below
 * are things TWO enforcement lanes must agree on, where a copy is not a
 * duplicated line but a silent divergence:
 *
 *   - if `run` and `verify` resolve a plan argument differently, verify judges
 *     a file `run` never executed;
 *   - if the phase-close probe and verify disagree about which states discharge
 *     a row's obligation, a phase closes in one lane and not the other.
 *
 * Asserting "exactly one definition exists" makes the disagreement impossible by
 * construction, which no behavioral test can do — two identical copies pass
 * every behavioral test right up until someone edits one of them.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Every `.ts` file under `src/`, excluding tests and test support. */
async function sourceFiles(dir: string = srcDir): Promise<string[]> {
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
	for (const file of await sourceFiles()) {
		if (pattern.test(await readFile(file, "utf8"))) hits.push(file);
	}
	return hits;
}

describe("A24 — one implementation of plan → impl.md resolution", () => {
	it("is defined exactly once across src/", async () => {
		const definitions = await filesMatching(/function\s+resolveImplPath\s*\(/);

		// Two copies existed: bin/commands/run.ts and lib/verify/verify.ts.
		expect(definitions).toHaveLength(1);
	});
});

describe("A25 — one definition of the terminal-state set", () => {
	it("is defined exactly once across src/", async () => {
		// The literal set that says a row's authoring obligation is discharged.
		const definitions = await filesMatching(
			/new Set\(\[\s*"written",\s*"passing",\s*"skipped",\s*"blocked",?\s*\]\)/,
		);

		// Two copies existed: run/probe.ts and verify/detect.ts. The JS hook
		// mirror in hooks/ is excluded on purpose — the port convention keeps it
		// a deliberate duplicate, and this scan covers src/ only.
		expect(definitions).toHaveLength(1);
	});
});
