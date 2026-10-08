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

	// context-tiers moved the token grammar out so the lesson token could share
	// it; the opener rule is the part two readers must agree on, so it is pinned
	// to its new home the same way.
	it("exactly one `export const TOKEN_OPENER` exists, in lib/tokens.ts", () => {
		const files = globSync("**/*.ts", { cwd: SRC, ignore: IGNORE }).sort();
		const definers = files.filter((f) =>
			/const TOKEN_OPENER\b/.test(readFileSync(join(SRC, f), "utf-8")),
		);
		expect(
			definers,
			"lesson: structural-single-definition-test-for-must-agree-invariants — two readers of one grammar drift silently",
		).toEqual(["lib/tokens.ts"]);
	});
});

/**
 * incident-recording — one writer of incidents. The admin's loop, catchup's
 * tool and `promises watch` all go through `recordBreaks`; a second caller of
 * the pass would be a second writer, the collision the lock exists to stop.
 */
describe("one writer of incidents", () => {
	const files = () => globSync("**/*.ts", { cwd: SRC, ignore: IGNORE }).sort();
	const matching = (re: RegExp) =>
		files().filter((f) => re.test(readFileSync(join(SRC, f), "utf-8")));

	it("`recordBreaks` is defined once, in lib/promises/record.ts", () => {
		expect(
			matching(/export async function recordBreaks\b/),
			"lesson: structural-single-definition-test-for-must-agree-invariants — one writer, or one break makes two incidents",
		).toEqual(["lib/promises/record.ts"]);
	});

	it("only the writer runs the pass", () => {
		expect(
			matching(/\bwatchPromises\(/).filter((f) => f !== "lib/promises/watch.ts"),
			"lesson: structural-single-definition-test-for-must-agree-invariants — a caller of the pass that skips the writer skips its commit and its lock",
		).toEqual(["lib/promises/record.ts"]);
	});
});
