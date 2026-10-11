#!/usr/bin/env node
/**
 * PreToolUse hook (Edit|Write): only a person approves a mockup.
 * promise: a-mockup-is-approved-by-a-person
 *
 * An app's `.indusk/mockups/<app>/approved.json` is the record of which
 * mockups a person approved, each entry bound to the mockup's and the
 * foundation's content hashes (ui-promises ADR decision 3). The cockpit's
 * Approve writes it, with the person who pressed it, and commits it on main.
 * An agent may draw and propose mockups, and change the foundation; it never
 * writes the record. This hook refuses an agent's Write or Edit to it, under
 * any app and wherever the project is.
 *
 * The rest of the rule is not the hook's: `indusk looks approve` exits 2, and
 * an entry whose hashes are not the mockup's current ones reads proposed —
 * a hand edit by a person is theirs to make, and holds only when it is true.
 *
 * Judged on the path the agent names, never on the file: nothing is read.
 *
 * Exit 0 = allow. Exit 2 = block (stderr reaches the agent).
 */

import { resolve } from "node:path";

const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit"]);
const RECORD = /(^|[\\/])\.indusk[\\/]mockups[\\/][^\\/]+[\\/]approved\.json$/i;

let input = "";
for await (const chunk of process.stdin) input += chunk;
let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0); // never block on our own parse failure
}

if (!WRITE_TOOLS.has(event.tool_name)) process.exit(0);
const filePath = event.tool_input?.file_path;
if (typeof filePath !== "string" || filePath === "") process.exit(0);

const absolute = resolve(event.cwd ?? process.cwd(), filePath);
if (!RECORD.test(absolute)) process.exit(0);

process.stderr.write(
	[
		`looks-approval-guard: refusing — ${filePath} is the record of what a person approved.`,
		"promise: a-mockup-is-approved-by-a-person",
		"",
		"A mockup becomes the reference only when a person approves it with the cockpit's Approve:",
		"`indusk ui`, the app's Looks page, the mockup opened at each device, then Approve.",
		"Draw or change the mockup (screens/<screen>.<state>.html) and the foundation as you need;",
		"a changed mockup reads proposed until a person approves it there.",
		"",
	].join("\n"),
);
process.exit(2);
