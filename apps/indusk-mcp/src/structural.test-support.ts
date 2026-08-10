import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Shared machinery for the structural tests — the ones that assert a rule has
 * exactly one definition rather than testing a behavior.
 *
 * Lives at `src/` rather than beside either caller because both `verify/` and
 * `shape/` need it and a helper kept in one domain's folder gets copied by the
 * next domain instead of imported. That is not a guess: this file exists
 * because exactly that happened — `shape/shared-definitions.test.ts` was
 * written by copying `verify/shared-resolution.test.ts`, and the two copies had
 * diverged within hours.
 *
 * Named `.test-support.` deliberately: the walk below skips `.test.` and
 * `.test-support.` files, so this module is excluded from its own scans, which
 * is what a "how many definitions ship?" question wants.
 */

/** Every `.ts` file under `dir`, excluding tests, test support, and `__tests__/`. */
export async function sourceFiles(dir: string): Promise<string[]> {
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

/** Source files under `dir` whose contents match `pattern`. */
export async function filesMatching(dir: string, pattern: RegExp): Promise<string[]> {
	const hits: string[] = [];
	for (const file of await sourceFiles(dir)) {
		if (pattern.test(await readFile(file, "utf8"))) hits.push(file);
	}
	return hits;
}
