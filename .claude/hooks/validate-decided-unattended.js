#!/usr/bin/env node
/**
 * PreToolUse hook (Edit|Write): a choice is never decided silently.
 * lesson: choices-are-asked-as-questions
 * clause: a-decision-is-a-question/never-decided-silently
 *
 * An unattended run (`INDUSK_GATE_POLICY=auto`) that meets a choice the plan does not
 * settle asks it as a question (`ask_decision`), and a plan document that records the
 * choice cites the question: `question: <id>` on the line or the next. A save that adds
 * a line saying "decided unattended" with no such reference, or one naming a question
 * the plan's record does not hold, is refused, naming the file and line.
 *
 * Only plan documents are read, and only the lines the save adds. The plan review, the
 * audit and the retrospective are not checked: they record a reader's answer, and review
 * and acceptance are stops for a person, not questions. A run with a person present is
 * asked, not checked, so the hook is silent unless the gate policy is `auto`.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { policyFromEnvironment } from "./_gate-policy.js";
import { mainCheckout } from "./_hook-paths.js";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const PLAN_DOCUMENT =
	/(^|[\\/])\.indusk[\\/]planning[\\/](?!archive[\\/])([^\\/]+)[\\/][^\\/]+\.md$/;
const NOT_CHECKED = new Set(["plan-review.md", "audit.md", "retrospective.md"]);
const DECIDED = /\bdecided unattended\b/i;
const REFERENCE = /\bquestion:\s*([A-Za-z0-9_-]+)/;

/** The lines `after` has that `before` did not: the save's additions, with their line numbers (1-based). */
export function addedLines(before, after, firstLine = 1) {
	const had = new Map();
	for (const line of before.split("\n")) had.set(line, (had.get(line) ?? 0) + 1);
	const added = [];
	after.split("\n").forEach((text, i) => {
		const n = had.get(text) ?? 0;
		if (n > 0) had.set(text, n - 1);
		else added.push({ line: firstLine + i, text });
	});
	return added;
}

/** The ids of the questions `plan`'s history holds, from the main checkout's history file. */
export function recordedQuestions(projectRoot, plan) {
	const file = join(mainCheckout(projectRoot), ".indusk", "plan-history", `${plan}.md`);
	if (!existsSync(file)) return new Set();
	const ids = new Set();
	for (const m of readFileSync(file, "utf-8").matchAll(
		/ question (\S+) (?:waiting|answered|went-ahead|answered-late) /g,
	)) {
		ids.add(m[1]);
	}
	return ids;
}

/** What is wrong with the lines a save adds: each recording of a choice with no question, or a made-up one. */
export function problems(added, allLines, recorded) {
	const out = [];
	for (const { line, text } of added) {
		if (!DECIDED.test(text)) continue;
		const next = allLines[line] ?? "";
		const ref = REFERENCE.exec(text) ?? REFERENCE.exec(next);
		if (!ref) {
			out.push({
				line,
				why: "records a choice as decided unattended with no `question: <id>`",
				text,
			});
		} else if (!recorded.has(ref[1])) {
			out.push({
				line,
				why: `cites question ${ref[1]}, which the plan's record does not hold`,
				text,
			});
		}
	}
	return out;
}

async function main() {
	let input = "";
	for await (const chunk of process.stdin) input += chunk;
	let event;
	try {
		event = JSON.parse(input);
	} catch {
		return 0; // never block on our own parse failure
	}
	if (policyFromEnvironment() !== "auto") return 0;
	if (!WRITE_TOOLS.has(event.tool_name)) return 0;
	const filePath = event.tool_input?.file_path;
	if (typeof filePath !== "string" || filePath === "") return 0;
	const absolute = resolve(event.cwd ?? process.cwd(), filePath);
	const match = PLAN_DOCUMENT.exec(absolute);
	if (!match || NOT_CHECKED.has(basename(absolute))) return 0;

	const existing = existsSync(absolute) ? readFileSync(absolute, "utf-8") : "";
	let after;
	let added;
	if (event.tool_name === "Write") {
		after = String(event.tool_input.content ?? "");
		added = addedLines(existing, after);
	} else {
		const edits =
			event.tool_name === "MultiEdit" ? (event.tool_input.edits ?? []) : [event.tool_input];
		after = existing;
		added = [];
		for (const e of edits) {
			const oldText = String(e.old_string ?? "");
			const newText = String(e.new_string ?? "");
			const at = oldText === "" ? -1 : after.indexOf(oldText);
			const first = at < 0 ? 1 : after.slice(0, at).split("\n").length;
			const next =
				at < 0
					? `${after}\n${newText}`
					: after.slice(0, at) + newText + after.slice(at + oldText.length);
			added.push(...addedLines(oldText, newText, first));
			after = next;
		}
	}
	const found = problems(
		added,
		after.split("\n"),
		recordedQuestions(absolute.split(/[\\/]\.indusk[\\/]planning[\\/]/)[0], match[2]),
	);
	if (found.length === 0) return 0;
	process.stderr.write(
		[
			`validate-decided-unattended: refusing — ${filePath} records a choice with no question.`,
			...found.map((p) => `  ${filePath}:${p.line} ${p.why}: ${p.text.trim().slice(0, 120)}`),
			"lesson: choices-are-asked-as-questions",
			"",
			"An unattended run asks a choice it cannot settle with the `ask_decision` tool (options, your",
			"recommendation and reason, a cost, what each option changes), then cites the question on the line:",
			"  Use SQLite. Decided unattended (question: q-3).",
			"",
		].join("\n"),
	);
	return 2;
}

if (
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith("validate-decided-unattended.js")
) {
	process.exit(await main());
}
