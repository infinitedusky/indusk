#!/usr/bin/env node
/**
 * PreToolUse hook: warns when working on a plan whose dependencies aren't completed.
 *
 * Checks brief.md frontmatter for `blocked_by` field (array of plan names).
 * A plan is "completed" when it exists in .indusk/planning/archive/.
 * If blockers aren't archived, exits with code 2 to require user approval.
 *
 * Exit 0 = allow
 * Exit 2 = ask for approval (stderr sent to agent as feedback)
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";

let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const toolInput = event.tool_input ?? {};
const filePath = toolInput.file_path ?? "";

// Only check impl.md files in planning directories
if (!filePath.includes("/planning/") || !filePath.endsWith("/impl.md")) {
	process.exit(0);
}

// Extract plan directory
const planDir = dirname(filePath);
const planName = basename(planDir);

// Skip archived plans
if (filePath.includes("/archive/")) {
	process.exit(0);
}

// Read brief.md for blocked_by
const briefPath = resolve(planDir, "brief.md");
if (!existsSync(briefPath)) {
	process.exit(0);
}

const briefContent = readFileSync(briefPath, "utf-8");
const fmMatch = briefContent.match(/^---\n([\s\S]*?)\n---\n/);
if (!fmMatch) {
	process.exit(0);
}

const frontmatter = fmMatch[1];
const blockedByMatch = frontmatter.match(/blocked_by:\s*\[([^\]]*)\]/);
if (!blockedByMatch) {
	// Also try YAML list format
	const yamlListMatch = frontmatter.match(/blocked_by:\s*\n((?:\s*-\s*.+\n?)+)/);
	if (!yamlListMatch) {
		process.exit(0);
	}
	var blockers = yamlListMatch[1]
		.split("\n")
		.map(l => l.replace(/^\s*-\s*/, "").trim())
		.filter(Boolean);
} else {
	var blockers = blockedByMatch[1]
		.split(",")
		.map(s => s.trim().replace(/['"]/g, ""))
		.filter(Boolean);
}

if (blockers.length === 0) {
	process.exit(0);
}

// Find project root (walk up to find .indusk/)
let projectRoot = planDir;
while (projectRoot !== "/" && !existsSync(resolve(projectRoot, ".indusk"))) {
	projectRoot = dirname(projectRoot);
}
if (projectRoot === "/") {
	// Can't find project root, skip check
	process.exit(0);
}

const archiveDir = resolve(projectRoot, ".indusk/planning/archive");
const archived = new Set();
if (existsSync(archiveDir)) {
	for (const entry of readdirSync(archiveDir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			archived.add(entry.name);
		}
	}
}

const incomplete = blockers.filter(b => !archived.has(b));

if (incomplete.length === 0) {
	process.exit(0);
}

// Block with approval required
process.stderr.write(
	`Plan "${planName}" is blocked by incomplete dependencies:\n` +
	incomplete.map(b => `  - ${b} (not archived)`).join("\n") +
	`\n\nThese plans must complete their retrospective and be archived first.\n` +
	`Check .indusk/planning/master.md for the execution order.\n` +
	`Override only if you have a good reason to work out of order.`
);
process.exit(2);
