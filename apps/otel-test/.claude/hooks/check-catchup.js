#!/usr/bin/env node
/**
 * PreToolUse hook: blocks Edit/Write on project files until /catchup is complete.
 *
 * Reads .claude/handoff.md and checks that all Catchup Status boxes are checked.
 * Allows edits TO the handoff file itself (so catchup can check off boxes).
 * Allows edits if no handoff file exists (first session, no enforcement).
 *
 * Exit 0 = allow
 * Exit 2 = block (stderr sent to agent)
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const toolInput = input.tool_input ?? {};
const filePath = toolInput.file_path ?? "";

// Find project root by looking for .claude/ directory
function findProjectRoot() {
	let dir = process.cwd();
	for (let i = 0; i < 10; i++) {
		if (existsSync(join(dir, ".claude"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return process.cwd();
}

const projectRoot = findProjectRoot();
const handoffPath = join(projectRoot, ".claude", "handoff.md");

// Allow if no handoff exists (first session or handoff not yet created)
if (!existsSync(handoffPath)) {
	process.exit(0);
}

// Always allow edits to the handoff file itself (catchup needs to check boxes)
if (filePath.endsWith("handoff.md")) {
	process.exit(0);
}

// Read the handoff and check catchup status
const content = readFileSync(handoffPath, "utf-8");

// Look for the Catchup Status section
const statusMatch = content.match(/## Catchup Status\n([\s\S]*?)(?:\n##|\n$|$)/);
if (!statusMatch) {
	// No catchup status section — allow (handoff was written before this feature)
	process.exit(0);
}

const statusSection = statusMatch[1];
const unchecked = [];
const checkboxes = statusSection.matchAll(/- \[( |x)\] (\w+)/g);

for (const match of checkboxes) {
	if (match[1] === " ") {
		unchecked.push(match[2]);
	}
}

if (unchecked.length === 0) {
	// All boxes checked — catchup is complete
	process.exit(0);
}

// Block the edit
process.stderr.write(
	`Catchup incomplete. Run /catchup before editing project files.\n` +
		`Missing steps: ${unchecked.join(", ")}\n` +
		`The handoff file (.claude/handoff.md) has unchecked catchup boxes. ` +
		`Complete each /catchup step to check them off.`,
);
process.exit(2);
