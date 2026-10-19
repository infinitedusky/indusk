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
	];
	it.each(cases)("%j", (text) => {
		const lines = text.split("\n");
		const added = lines.map((t, i) => ({ line: i + 1, text: t }));
		const hook = problems(added, lines, recorded).map((p) => p.line);
		expect(silentIn(text, recorded).map((p) => p.line)).toEqual(hook);
	});
});
