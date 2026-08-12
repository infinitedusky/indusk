import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

/**
 * A23 — trajectory-row parsing has one definition under `hooks/`.
 *
 * The same structural shape as A13, and for the same reason: no behavioural
 * test can catch a divergence that has not happened yet. This one is not
 * hypothetical though — it already happened, inside this plan. `check-gates.js`
 * carried its own `parseTrajectoryFromBody` with a local `Phase N` regex, so
 * when `Test Phase N` became a legal cell it read every row as `NaN` and Gate A
 * matched nothing at all. Nothing failed loudly; the gate just stopped
 * enforcing.
 *
 * A duplicated parser does not announce itself when it falls behind. Counting
 * definitions is the only check that fires before the divergence does.
 */

const hooksDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks");

/** Hook files that define their own trajectory-row parser. */
async function definers(): Promise<string[]> {
	const files = await glob("*.js", { cwd: hooksDir, absolute: true });
	const hits: string[] = [];
	for (const file of files) {
		const source = await readFile(file, "utf8");
		// A definition, not a call — `function parseTrajectoryFromBody(`.
		if (/\bfunction\s+parseTrajectoryFromBody\s*\(/.test(source)) {
			hits.push(relative(hooksDir, file));
		}
	}
	return hits.sort();
}

describe("A23 — one trajectory-row parser under hooks/", () => {
	it("finds hook files to scan (sanity)", async () => {
		const files = await glob("*.js", { cwd: hooksDir });
		expect(files.length).toBeGreaterThan(3);
	});

	it("is defined exactly once", async () => {
		// The shared definition belongs in a `_`-prefixed hook-local module,
		// which both hooks import — the established pattern (`_hook-paths.js`,
		// `_impl-headings.js`): no settings entry, but it must live in `hooks/`
		// or the importing hook dies at load.
		expect(await definers()).toEqual(["_trajectory-parser.js"]);
	}, 30_000);
});
