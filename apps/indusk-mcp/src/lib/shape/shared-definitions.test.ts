import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A18, A19 — one definition per shared rule, asserted structurally.
 *
 * Same instrument as `verify/shared-resolution.test.ts`, for the same reason:
 * two identical copies pass every behavioral test right up until someone edits
 * one of them. A test that asserts "exactly one definition exists" makes the
 * divergence impossible by construction; no behavioral test can, because the
 * divergence has not happened yet.
 *
 * Both rules here are facts about TWO files, which is why neither was visible
 * to Shape at any phase boundary — the second copy is not a property of the
 * phase that wrote it.
 */

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "../..");
const shapeDir = join(dirname(fileURLToPath(import.meta.url)));

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

async function filesMatching(dir: string, pattern: RegExp): Promise<string[]> {
	const hits: string[] = [];
	for (const file of await sourceFiles(dir)) {
		if (pattern.test(await readFile(file, "utf8"))) hits.push(file);
	}
	return hits;
}

/**
 * Every `.ts` file under `src/`, INCLUDING tests and test support.
 *
 * The scanner below deliberately skips those, which is right for asking "how
 * many definitions ship" and wrong for asking "how many copies of the scanner
 * exist" — both copies lived in `.test.ts` files, invisible to the very walk
 * they were copies of.
 */
async function allTypeScriptFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === "node_modules") continue;
			out.push(...(await allTypeScriptFiles(full)));
			continue;
		}
		if (entry.name.endsWith(".ts")) out.push(full);
	}
	return out;
}

describe("A27 — one definition of the source scanner the structural tests use", () => {
	it("is defined exactly once across src/, tests included", async () => {
		// The one-definition rule turned on the tests that enforce it. Two copies
		// existed — verify/shared-resolution.test.ts and this file — and they had
		// ALREADY diverged within hours: one signature defaulted `dir`, the other
		// required it. That drift is the whole argument.
		const hits: string[] = [];
		for (const file of await allTypeScriptFiles(srcDir)) {
			if (/async function sourceFiles\s*\(/.test(await readFile(file, "utf8"))) hits.push(file);
		}

		expect(hits).toHaveLength(1);
	});
});

describe("A18 — one definition of the async git runner", () => {
	it("is defined exactly once across src/", async () => {
		const definitions = await filesMatching(srcDir, /async function git\s*\(/);

		// Two copies existed: verify/git.ts and shape/changed.ts, identical down
		// to the 32 MB maxBuffer. The Boundary Map said Phase 1 would consume
		// verify/git.ts; what happened is the precedent got copied instead.
		//
		// cleanup/oversized.ts's `git` is deliberately NOT counted: it is
		// synchronous, takes an args array, and swallows errors to "" because its
		// callers tolerate absence. Different signature, different error
		// semantics — a different function that shares a name, the same way the
		// JS hook mirrors are excluded from the verify scan.
		expect(definitions).toHaveLength(1);
	});

	it("shape reads the shared runner rather than defining one", async () => {
		const local = await filesMatching(shapeDir, /async function git\s*\(/);

		expect(local).toHaveLength(0);
	});
});

describe("A19 — one definition of the phase-block scan", () => {
	it("the heading pattern that ends a block appears exactly once in lib/shape", async () => {
		// `findings.ts` walks from a `### Phase N` heading to the first heading
		// after it; Phase 5 added `verificationGateLines` to `shape.ts`, which
		// walks from a `#### Phase N Verification` heading with its own copy of
		// the same rule. The two differ only in which heading they start at.
		const definitions = await filesMatching(shapeDir, /#\{2,4\}/);

		expect(definitions).toHaveLength(1);
	});

	it("only one file builds a phase-heading matcher", async () => {
		// Both callers interpolate the phase number into a heading regex. After
		// the extraction exactly one file should still be doing that.
		const definitions = await filesMatching(shapeDir, /new RegExp\([^)]*Phase/);

		expect(definitions).toHaveLength(1);
	});
});
