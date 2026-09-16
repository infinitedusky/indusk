import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "./helpers/cli.js";

/**
 * dawn-workbench-execution — A19 (cleanup).
 *
 * "What is HEAD here" was spelled three times by the end of this plan:
 * `verify/git.ts` had `headSha`, `run/commit-cadence.ts` ran `rev-parse HEAD`
 * inline after each commit, and `run/loop.ts` grew `headOf` for the
 * `Code-Commit:` trailer. A git *primitive* belongs in `lib/git.ts` — the
 * repository's own rule, written after the runner was copied — and this pins
 * the fifth instance of it: one `headSha` / `headShaOrNull`, and every
 * consumer importing rather than re-spelling.
 *
 * Test fixtures (`*.test-support.ts`) are outside the pin: they share the
 * throwing runner in `__tests__/helpers/test-git.ts`, a different contract.
 */

const SRC_LIB = join(REPO_ROOT, "apps/indusk-mcp/src/lib");
const IGNORE = ["**/*.test.ts", "**/*.test-support.ts"];
/** `rev-parse HEAD` with or without `--verify`; `--short HEAD` is a different question and stays. */
const HEAD_SPELLING = /"rev-parse",\s*(?:"--verify",\s*)?"HEAD"/;
/**
 * The modules that used to spell it themselves. The loop's trailer wiring
 * moved into `run/cadences.ts` with the rest of the cadence construction, so
 * that is where the loop's copy is now imported.
 */
const CONSUMERS = ["verify/git.ts", "run/commit-cadence.ts", "run/cadences.ts"];

function libFiles(): string[] {
	return globSync("**/*.ts", { cwd: SRC_LIB, ignore: IGNORE }).sort();
}

describe("A19 — one HEAD-sha primitive under src/lib", () => {
	it("exactly one definition each of headSha and headShaOrNull, both in lib/git.ts", () => {
		const files = libFiles();
		const definers = (name: string) =>
			files.filter((f) =>
				new RegExp(`export async function ${name}\\b`).test(
					readFileSync(join(SRC_LIB, f), "utf-8"),
				),
			);
		expect(definers("headSha")).toEqual(["git.ts"]);
		expect(definers("headShaOrNull")).toEqual(["git.ts"]);
	});

	it("no other module under src/lib spells `rev-parse HEAD` itself", () => {
		const spellers = libFiles().filter((f) =>
			HEAD_SPELLING.test(readFileSync(join(SRC_LIB, f), "utf-8")),
		);
		expect(spellers).toEqual(["git.ts"]);
	});

	it("verify's git surface, the commit cadence and the run cadence wiring import the one", () => {
		for (const rel of CONSUMERS) {
			const source = readFileSync(join(SRC_LIB, rel), "utf-8");
			expect(source, `${rel} does not import headSha/headShaOrNull from lib/git`).toMatch(
				/import \{[^}]*\bheadSha(?:OrNull)?\b[^}]*\} from "\.\.\/git\.js"/,
			);
		}
	});

	it("the run loop no longer carries its own git process runner", () => {
		const loop = readFileSync(join(SRC_LIB, "run/loop.ts"), "utf-8");
		expect(loop).not.toMatch(/execFileAsync|from "node:child_process"/);
	});
});
