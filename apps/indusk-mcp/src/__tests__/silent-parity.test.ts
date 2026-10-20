// clause: a-decision-is-a-question/never-decided-silently
import { describe, expect, it } from "vitest";
import { problems } from "../../hooks/validate-decided-unattended.js";
import { silentIn } from "../lib/questions/silent.js";

/** The hook and its library port read the same lines the same way (hooks/CLAUDE.md: change both together). */
describe("validate-decided-unattended.js and lib/questions/silent.ts agree", () => {
	const recorded = new Set(["q-3"]);
	const cases = [
		"1. Use SQLite. Decided unattended: simplest.",
		"1. Use SQLite. Decided unattended (question: q-3).",
		"1. Use SQLite. Decided unattended (question: q-99).",
		"Decided unattended\nquestion: q-3",
		"Decided unattended\nnothing here",
		"no such phrase at all",
		// T35: a mention inside quotes or backticks is not a use of the phrase
		'The rule refuses "decided unattended" with no reference.',
		"The rule refuses `decided unattended` with no reference.",
		// T36: other words for the same thing, and a list under such a line
		"Decisions made unattended:\n1. Use SQLite\n2. Use Postgres",
		"Decisions made unattended (question: q-3):\n1. Use SQLite (question: q-3)\n2. Use Postgres (question: q-3)",
		"Decisions made unattended:\n- Use SQLite (question: q-3)\n- Use Postgres",
		"Chosen unattended: SQLite.",
		"Chosen unattended: SQLite (question: q-3).",
		"This was made quietly unattended.",
	];
	it.each(cases)("%j", (text) => {
		const lines = text.split("\n");
		const added = lines.map((t, i) => ({ line: i + 1, text: t }));
		const hook = problems(added, lines, recorded).map((p) => p.line);
		expect(silentIn(text, recorded).map((p) => p.line)).toEqual(hook);
	});
});
