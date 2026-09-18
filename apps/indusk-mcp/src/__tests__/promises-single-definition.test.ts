// promise: one-definition-per-shared-rule
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * day-promises — A25: exactly one definition of the promise vocabulary.
 *
 * The lifecycle's unions are pinned this way (`lifecycle-single-definition`),
 * and the ADR keeps the promise unions in their own module rather than
 * inside `lib/lifecycle.ts`. Zero definitions today, so this is red until
 * `lib/promises/vocabulary.ts` exists; a second copy anywhere under `src/`
 * turns it red again.
 */

const SRC = join(REPO_ROOT, "apps/indusk-mcp/src");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts", "__tests__/**"];
const TUPLES = ["PROMISE_KINDS", "PROMISE_STATES", "PROMISE_LIFETIMES", "INCIDENT_SOURCES"];

describe("A25 — one promise vocabulary under src/", () => {
	it.each(TUPLES)("exactly one `export const %s` exists, in lib/promises/vocabulary.ts", (name) => {
		const files = globSync("**/*.ts", { cwd: SRC, ignore: IGNORE }).sort();
		const definers = files.filter((f) =>
			new RegExp(`export const ${name}\\b`).test(readFileSync(join(SRC, f), "utf-8")),
		);
		expect(definers).toEqual(["lib/promises/vocabulary.ts"]);
	});
});
