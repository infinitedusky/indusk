#!/usr/bin/env node
/**
 * PreToolUse hook (Edit|Write, and Bash): only a person approves a mockup.
 * promise: a-mockup-is-approved-by-a-person
 *
 * An app's `.indusk/mockups/<app>/approved.json` is the record of which
 * mockups a person approved, each entry bound to the hashes of the mockup the
 * person was shown, the foundation and the declarations the check trusts
 * (ui-promises ADR decision 3). The cockpit's Approve writes it, with the
 * person who pressed it. An agent may draw and propose mockups, and change the
 * foundation; it never writes the record. This hook refuses:
 *
 *   - an agent's Write or Edit to the record, under any app, wherever the
 *     project is — judged on the path named, never on the file;
 *   - an agent's Bash command whose text names the record with a write: a
 *     redirect onto it, or a segment run by a writing command (`tee`, `cp`,
 *     `mv`, `sed -i`, an interpreter's `-e`, `git checkout|restore …`);
 *   - an agent's Bash command that names the approve route
 *     (`/api/looks/<app>/approve`) or the unapprove route
 *     (`/api/looks/<app>/unapprove`, storybook-components ADR decision 11:
 *     taking an approval back is the person's as giving it is) — the routes
 *     are the person's, pressed in their browser.
 *
 * What it cannot see: a command that builds the path or the URL at run time
 * (a script file, a variable, an encoded string). It is a tripwire for an
 * agent's ordinary attempt, not a boundary against a process running as the
 * person — nothing on the person's machine can be. What holds past it is the
 * record itself: an entry reads approved only while its hashes are the true
 * ones, and the record is in git, where a forged entry is a visible commit.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import { resolve } from "node:path";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const RECORD = /(^|[\\/])\.indusk[\\/]mockups[\\/][^\\/]+[\\/]approved\.json$/i;
/** The record named anywhere in a command's text. */
const RECORD_IN_TEXT = /\.indusk[\\/]mockups[\\/][^\s\\/'"`]+[\\/]approved\.json/i;
/** A redirect whose target is the record: `> path`, `>> path`, `>| path`. */
const REDIRECT_ONTO_RECORD =
	/>{1,2}\|?\s*["']?[^\s"']*\.indusk[\\/]mockups[\\/][^\s\\/'"`]+[\\/]approved\.json/i;
/** The approve route named anywhere in a command's text. */
const APPROVE_ROUTE = /\/api\/looks\/[^\s'"`]*approve/i;
/** The unapprove route (ADR decision 11): taking an approval back is the person's as giving it is. */
const UNAPPROVE_ROUTE = /\/api\/looks\/[^\s'"`]*unapprove/i;

/** Commands that write the files they are handed. */
const WRITERS = new Set([
	"tee",
	"cp",
	"mv",
	"install",
	"rsync",
	"dd",
	"truncate",
	"ln",
	"rm",
	"touch",
	"sponge",
	"node",
	"python",
	"python3",
	"perl",
	"ruby",
	"deno",
	"bun",
	"tsx",
]);
/** `git` subcommands that write a file in the working tree. */
const GIT_WRITERS = new Set(["checkout", "restore", "apply", "mv", "rm", "reset", "stash"]);

/** The command's segments: split on `;`, `&&`, `||`, `|` and newlines. */
function segments(command) {
	return command.split(/\|\||&&|[;|\n]/).map((s) => s.trim());
}

/** The words of a segment, quotes stripped; leading `VAR=value`, `sudo`, `env` and `command` skipped. */
function wordsOf(segment) {
	const words = (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((w) =>
		w.replace(/^["']|["']$/g, ""),
	);
	while (
		words.length > 0 &&
		(/^\w+=/.test(words[0]) || ["sudo", "env", "command"].includes(words[0]))
	)
		words.shift();
	return words;
}

/** Whether one segment of a command writes the record it names. */
function segmentWrites(segment) {
	if (!RECORD_IN_TEXT.test(segment)) return false;
	if (REDIRECT_ONTO_RECORD.test(segment)) return true;
	const [verb = "", sub = "", ...rest] = wordsOf(segment);
	const name = verb.split("/").pop() ?? verb;
	if (name === "sed")
		return [sub, ...rest].some((w) => /^-[a-zA-Z]*i/.test(w) || w === "--in-place");
	if (name === "git") return GIT_WRITERS.has(sub);
	return WRITERS.has(name);
}

/** Why a Bash command is refused, or null to let it run. */
function bashRefusal(command) {
	if (UNAPPROVE_ROUTE.test(command)) return "it calls the cockpit's unapprove route";
	if (APPROVE_ROUTE.test(command)) return "it calls the cockpit's approve route";
	if (segments(command).some(segmentWrites))
		return "it writes the record of what a person approved";
	return null;
}

function refuse(what, why) {
	process.stderr.write(
		[
			`looks-approval-guard: refusing — ${what}: ${why}.`,
			"promise: a-mockup-is-approved-by-a-person",
			"",
			"A mockup becomes the reference only when a person approves it with the cockpit's Approve,",
			"and stops being one only when a person takes it back with the cockpit's Unapprove:",
			"`indusk ui`, the app's Looks page, the mockup opened at each device, then Approve (or Unapprove).",
			"Draw or change the mockup (screens/<screen>.<state>.html) and the foundation as you need;",
			"a changed mockup reads proposed until a person approves it there.",
			"",
		].join("\n"),
	);
	process.exit(2);
}

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0); // never block on our own parse failure
}

if (event.tool_name === "Bash") {
	const command = event.tool_input?.command;
	if (typeof command !== "string") process.exit(0);
	const why = bashRefusal(command);
	if (why) refuse(command.length > 120 ? `${command.slice(0, 117)}...` : command, why);
	process.exit(0);
}

if (!WRITE_TOOLS.has(event.tool_name)) process.exit(0);
const filePath = event.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") process.exit(0);

const absolute = resolve(event.cwd ?? process.cwd(), filePath);
if (!RECORD.test(absolute)) process.exit(0);
refuse(filePath, "it is the record of what a person approved");
