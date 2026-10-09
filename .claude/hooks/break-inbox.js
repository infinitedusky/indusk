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
 * context, and marks them delivered to this session by appending
 * `{ id, session }` to `inbox-delivered.jsonl`, so its next prompt repeats
 * nothing and every other running session still hears each break once on its
 * own next turn. A mark with no session counts for every session. A session
 * in another project reads another home and hears nothing.
 *
 * A session that starts later has been given nothing, so it is told only what
 * is still true (incident-recording A30, A31): an entry whose incident file
 * says it is no longer open is marked delivered and not said, and the
 * entries for one incident — its break and its daily reminders — are said as
 * one line, the newest's. An incident file that cannot be found counts as
 * open: an unknown is said, never dropped.
 *
 * It runs on every prompt, so it does one small read and exits: nothing to
 * say is an exit 0 with no output. An inbox it cannot read is said on its own
 * line, never skipped — a break that could not be delivered must not look like
 * a quiet inbox.
 *
 * Exit 0 always: this hook informs, it never blocks a prompt.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectHome, resolveStateAndGitPaths } from "./_hook-paths.js";
import { markDelivered, undelivered } from "./_inbox.js";

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0);
}

let statePath = null;
let gitPath = null;
try {
	({ statePath, gitPath } = resolveStateAndGitPaths(event.cwd ?? process.cwd()));
} catch {
	process.exit(0);
}
if (!statePath) process.exit(0);

const home = projectHome(statePath);
const session = typeof event.session_id === "string" ? event.session_id : "";
const inbox = undelivered(home, session, { isOpen: incidentIsOpen });
const toSay = inbox.entries;

if (inbox.ids.length === 0 && inbox.problems.length === 0) process.exit(0);
if (toSay.length === 0 && inbox.problems.length === 0) {
	markDelivered(home, inbox.ids, session);
	process.exit(0);
}

const lines = [];
if (toSay.length > 0) {
	lines.push(
		"A promise broke in production. It outranks the roadmap: say it before anything else, and work the Maintenance phase named.",
	);
	for (const e of toSay) lines.push(`- ${describe(e)}`);
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
markDelivered(home, inbox.ids, session);
process.exit(0);

/**
 * Whether the incident's file still says `open`. The registry is the
 * project's own `.indusk/promises/`, or, in a workbench, the code repo's.
 */
function incidentIsOpen(id) {
	if (typeof id !== "string" || !/^[\w.-]+$/.test(id)) return true;
	for (const root of [statePath, gitPath]) {
		if (!root) continue;
		const file = join(root, ".indusk", "promises", "incidents", `${id}.md`);
		if (!existsSync(file)) continue;
		let text;
		try {
			text = readFileSync(file, "utf-8");
		} catch {
			return true;
		}
		const front = text.match(/^---\n([\s\S]*?)\n---/);
		const status = front?.[1].match(/^status:\s*["']?([\w-]+)/m)?.[1];
		return status === undefined || status === "open";
	}
	return true;
}

function describe(e) {
	const what =
		e.kind === "reminder"
			? `still open (a daily reminder): incident ${e.incident}`
			: `incident ${e.incident}`;
	return `\`${e.promise}\` — ${what}; ${e.owner} is reopened with ${e.phase}`;
}

/** Every JSON line in `path`, and each line that is not JSON, by number. */
