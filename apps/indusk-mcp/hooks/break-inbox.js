#!/usr/bin/env node
/**
 * UserPromptSubmit hook: a break reaches the working agent (incident-recording,
 * ADR D5).
 * promise: a-break-reaches-the-working-agent
 *
 * The recorder (the admin's loop, catchup, `watch`) leaves each incident it
 * opens or extends, and each daily reminder, in the project's inbox — a JSON
 * line in the project's home. On every prompt this hook reads the entries no
 * session has been given yet, puts them in front of the agent as additional
 * context, and marks them delivered by appending their ids to
 * `inbox-delivered.jsonl`, so the next prompt repeats nothing. A session in
 * another project reads another home and hears nothing.
 *
 * It runs on every prompt, so it does one small read and exits: nothing to
 * say is an exit 0 with no output. An inbox it cannot read is said on its own
 * line, never skipped — a break that could not be delivered must not look like
 * a quiet inbox.
 *
 * Exit 0 always: this hook informs, it never blocks a prompt.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectHome, resolveStateAndGitPaths } from "./_hook-paths.js";

const INBOX = "inbox.jsonl";
const DELIVERED = "inbox-delivered.jsonl";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0);
}

let statePath = null;
try {
	({ statePath } = resolveStateAndGitPaths(event.cwd ?? process.cwd()));
} catch {
	process.exit(0);
}
if (!statePath) process.exit(0);

const home = projectHome(statePath);
const inbox = readLines(join(home, INBOX));
const delivered = new Set(readLines(join(home, DELIVERED)).values.map((v) => v?.id));
const fresh = inbox.values.filter((e) => e && typeof e.id === "string" && !delivered.has(e.id));

if (fresh.length === 0 && inbox.problems.length === 0) process.exit(0);

const lines = [];
if (fresh.length > 0) {
	lines.push(
		"A promise broke in production. It outranks the roadmap: say it before anything else, and work the Maintenance phase named.",
	);
	for (const e of fresh) lines.push(`- ${describe(e)}`);
}
for (const problem of inbox.problems) {
	lines.push(
		`The break inbox could not be read: ${problem} — run catchup's promise step to see what it holds.`,
	);
}

console.info(
	JSON.stringify({
		hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: lines.join("\n") },
	}),
);
if (fresh.length > 0) {
	appendFileSync(
		join(home, DELIVERED),
		`${fresh.map((e) => JSON.stringify({ id: e.id })).join("\n")}\n`,
	);
}
process.exit(0);

function describe(e) {
	const what =
		e.kind === "reminder"
			? `still open (a daily reminder): incident ${e.incident}`
			: `incident ${e.incident}`;
	return `\`${e.promise}\` — ${what}; ${e.owner} is reopened with ${e.phase}`;
}

/** Every JSON line in `path`, and each line that is not JSON, by number. */
function readLines(path) {
	if (!existsSync(path)) return { values: [], problems: [] };
	const values = [];
	const problems = [];
	let text;
	try {
		text = readFileSync(path, "utf-8");
	} catch (err) {
		return { values, problems: [`${path}: ${err.message}`] };
	}
	text.split("\n").forEach((line, i) => {
		if (!line.trim()) return;
		try {
			values.push(JSON.parse(line));
		} catch {
			problems.push(`${path}:${i + 1} is not JSON`);
		}
	});
	return { values, problems };
}
