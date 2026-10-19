import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * clause: a-plan-runs-its-tests-and-what-must-not-break/nothing-else-runs
 * promise: a-plan-runs-its-tests-and-what-must-not-break
 *
 * T4 of a-plan-runs-what-must-not-break: the same skills say a phase runs its
 * rows and its brief's Must-not-break tests, and never mention tests a change
 * reaches (those are no longer searched for). The sampler will choose by what
 * each test executes; until then the set is the certain one.
 *
 * T7 of tests-never-make-us-wait. The skills that drive a phase and a landing
 * tell a plan to run its test set (`indusk plans tests`), never the whole
 * suite or the slow tier. A skill that still says "run `pnpm test`" at landing
 * sends the next plan back to waiting on tests it did not touch.
 *
 * A forbidden command is allowed only where its own sentence forbids it
 * ("never run ...", "do not ..." before it). The retrospective's release section is read too: it
 * must not tell landing to run them either.
 */

const SKILLS = resolve(dirname(fileURLToPath(import.meta.url)), "../../skills");
const NAMES = ["work", "verify", "retrospective"] as const;

/** Commands that run more than the plan's own set. Data: a new one is one row. */
const WHOLE_SUITE: Array<{ name: string; re: RegExp }> = [
	{ name: "pnpm test", re: /pnpm test(?![:\w-])/ },
	{ name: "pnpm turbo test", re: /pnpm turbo test/ },
	{ name: "indusk checks slow", re: /indusk checks slow/ },
	{ name: "test:system", re: /test:system/ },
];

const FORBIDS = /\b(never|do not|don't)\b/i;

/** The words of the sentence before `index`, where a prohibition would stand. */
function sentenceBefore(text: string, index: number): string {
	const before = text.slice(0, index);
	return before.slice(Math.max(before.lastIndexOf(". "), before.lastIndexOf("| ")) + 1);
}

/** Ways a skill can tell a plan to run the tests a change imports. Data: a new wording is one row. */
const REACHED: RegExp[] = [
	/tests? (?:whose imports|that import)/i,
	/\b(?:changes?|changed files?|branch|plan) (?:\w+ )?reach(?:es)?\b/i,
	/\breach(?:es)? the files/i,
	/vitest related/i,
	/search for importers/i,
];

/** The lines of `source` that name tests a change reaches. */
export function reachedLines(source: string): number[] {
	const found: number[] = [];
	source.split("\n").forEach((text, i) => {
		if (REACHED.some((re) => re.test(text))) found.push(i + 1);
	});
	return found;
}

/** Whether some sentence says a phase runs its rows and the Must-not-break tests. */
export function saysWhatAPhaseRuns(source: string): boolean {
	return source
		.split(/(?<=[.!?:])\s+|\n/)
		.some((s) => /\bphase\b/i.test(s) && /\brows?\b/i.test(s) && /must[- ]not[- ]break/i.test(s));
}

/** Every line of `source` that tells the reader to run a command beyond the plan's set. */
export function wholeSuiteLines(source: string): Array<{ line: number; command: string }> {
	const found: Array<{ line: number; command: string }> = [];
	source.split("\n").forEach((text, i) => {
		for (const c of WHOLE_SUITE) {
			const m = c.re.exec(text);
			// A prohibition stands before the command, in its own sentence.
			if (m && !FORBIDS.test(sentenceBefore(text, m.index)))
				found.push({ line: i + 1, command: c.name });
		}
	});
	return found;
}

describe("skills run the plan's test set (T7)", () => {
	for (const name of NAMES) {
		const source = readFileSync(resolve(SKILLS, `${name}.md`), "utf-8");

		it(`${name}.md names \`indusk plans tests\``, () => {
			expect(
				source.includes("indusk plans tests"),
				`skills/${name}.md must tell a plan to run \`indusk plans tests\``,
			).toBe(true);
		});

		it(`${name}.md never tells a phase or a landing to run the whole suite or the slow tier`, () => {
			const lines = source.split("\n");
			const report = wholeSuiteLines(source)
				.map(
					(f) =>
						`  skills/${name}.md:${f.line} — ${f.command}: ${lines[f.line - 1].trim().slice(0, 100)}`,
				)
				.join("\n");
			expect(
				wholeSuiteLines(source),
				`These lines tell a plan to run more than its test set; name \`indusk plans tests <plan> --phase N | --landing\` instead:\n${report}`,
			).toEqual([]);
		});
	}

	for (const name of NAMES) {
		const source = readFileSync(resolve(SKILLS, `${name}.md`), "utf-8");

		it(`${name}.md says a phase runs its rows and its Must-not-break tests`, () => {
			expect(
				saysWhatAPhaseRuns(source),
				`skills/${name}.md must say a phase runs its rows' tests and the brief's Must-not-break promises' tests`,
			).toBe(true);
		});

		it(`${name}.md never mentions tests a change reaches`, () => {
			const lines = source.split("\n");
			const report = reachedLines(source)
				.map((n) => `  skills/${name}.md:${n}: ${lines[n - 1].trim().slice(0, 100)}`)
				.join("\n");
			expect(
				reachedLines(source),
				`A plan no longer runs tests a change reaches; these lines say it does:\n${report}`,
			).toEqual([]);
		});
	}

	it("the reached-tests check flags a telling and passes unrelated uses of reach", () => {
		expect(
			reachedLines(
				[
					"It runs the tests whose imports reach the files.",
					"A test that reaches its subject over HTTP.",
				].join("\n"),
			),
		).toEqual([1]);
		expect(saysWhatAPhaseRuns("A phase runs its rows and the Must not break tests.")).toBe(true);
		expect(saysWhatAPhaseRuns("A landing runs every row and the Must not break tests.")).toBe(
			false,
		);
	});

	it("the forbidden-phrase check flags a telling and passes a prohibition", () => {
		const source = [
			"Run `pnpm test` to confirm.",
			"Never run `indusk checks slow` at a phase.",
			"Do not rebase. Then run `indusk checks slow` at landing.",
		].join("\n");
		expect(wholeSuiteLines(source)).toEqual([
			{ line: 1, command: "pnpm test" },
			{ line: 3, command: "indusk checks slow" },
		]);
	});
});
