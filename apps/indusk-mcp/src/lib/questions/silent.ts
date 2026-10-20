import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The save-time check's rule (`hooks/validate-decided-unattended.js`), as a read over a
 * plan's saved documents, so a step that ends can report the clause the hook enforces
 * (`never-decided-silently`). The hook cannot import this library, so this is its
 * port: change the two together; `silent-parity.test.ts` runs the same cases through both.
 *
 * The rule: a line saying a choice was decided, made or chosen unattended needs a
 * `question: <id>` on it or the next line, naming a question the plan's record holds; when
 * that line ends in `:`, every item of the list under it needs one. Text inside double
 * quotes or backticks is a mention of the phrase, not a use of it, and is ignored. Only the
 * lines a step added are judged, so a document that quotes the rule is not a break.
 *
 * clause: a-decision-is-a-question/never-decided-silently
 */
const DECIDED = /\b(?:decided|made|chosen)\s+(?:\w+\s+){0,2}?unattended\b/i;
const REFERENCE = /\bquestion:\s*([A-Za-z0-9_-]+)/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+/;
const QUOTED = /`[^`]*`|"[^"]*"/g;
/** A reader's answer, not a choice: never checked. */
const NOT_CHECKED = new Set(["plan-review.md", "audit.md", "retrospective.md"]);

export interface SilentDecision {
	file: string;
	line: number;
	why: string;
}

/** The lines `after` has that `before` did not, with their 1-based numbers. */
export function addedLines(before: string, after: string): { line: number; text: string }[] {
	const had = new Map<string, number>();
	for (const line of before.split("\n")) had.set(line, (had.get(line) ?? 0) + 1);
	const added: { line: number; text: string }[] = [];
	after.split("\n").forEach((text, i) => {
		const n = had.get(text) ?? 0;
		if (n > 0) had.set(text, n - 1);
		else added.push({ line: i + 1, text });
	});
	return added;
}

/** The items of the list under line `at` (0-based): each item's first line number and its text. */
function itemsUnder(lines: readonly string[], at: number): { line: number; text: string }[] {
	const items: { line: number; text: string }[] = [];
	for (let j = at + 1; j < lines.length; j++) {
		const l = lines[j] ?? "";
		if (LIST_ITEM.test(l)) items.push({ line: j + 1, text: l });
		else if (l.trim() === "") {
			const next = lines.slice(j + 1).find((x) => x.trim() !== "");
			if (next === undefined || !LIST_ITEM.test(next)) break;
		} else if (/^\s/.test(l) && items.length > 0) {
			const last = items[items.length - 1];
			if (last) last.text += `\n${l}`;
		} else break;
	}
	return items;
}

/**
 * The lines of one document that record a choice with no question, or a made-up one.
 * `judged` limits the check to those 1-based line numbers (a step's added lines).
 */
export function silentIn(
	text: string,
	recorded: ReadonlySet<string>,
	judged?: ReadonlySet<number>,
): { line: number; why: string }[] {
	const lines = text.split("\n");
	const out: { line: number; why: string }[] = [];
	const check = (line: number, cited: string, what: string) => {
		const ref = REFERENCE.exec(cited);
		if (!ref) out.push({ line, why: `${what} with no \`question: <id>\`` });
		else if (!recorded.has(ref[1] ?? ""))
			out.push({
				line,
				why: `cites question ${ref[1]}, which the plan's record does not hold`,
			});
	};
	lines.forEach((l, i) => {
		if (judged && !judged.has(i + 1)) return;
		if (!DECIDED.test(l.replace(QUOTED, ""))) return;
		check(i + 1, `${l}\n${lines[i + 1] ?? ""}`, "records a choice as decided unattended");
		if (/:\s*$/.test(l.trim()))
			for (const item of itemsUnder(lines, i))
				check(item.line, item.text, "lists a choice made unattended");
	});
	return out;
}

/** The markdown documents of a plan folder, by file name. */
export function documentsOf(planDir: string): Map<string, string> {
	const docs = new Map<string, string>();
	if (!existsSync(planDir)) return docs;
	for (const file of readdirSync(planDir))
		if (file.endsWith(".md") && !NOT_CHECKED.has(file))
			docs.set(file, readFileSync(join(planDir, file), "utf-8"));
	return docs;
}

/**
 * Every such line across a plan folder's documents; with `before` (the documents as a step
 * began), only the lines added since.
 */
export function silentDecisions(
	planDir: string,
	recorded: ReadonlySet<string>,
	before?: ReadonlyMap<string, string>,
): SilentDecision[] {
	return [...documentsOf(planDir)].flatMap(([file, text]) =>
		silentIn(
			text,
			recorded,
			before ? new Set(addedLines(before.get(file) ?? "", text).map((a) => a.line)) : undefined,
		).map((p) => ({ file, ...p })),
	);
}
