#!/usr/bin/env node
/**
 * PreToolUse hook: CLAUDE.md size budget (indusk-makeover Phase 2).
 *
 * CLAUDE.md is injected into every session — its size is the multiplier on all
 * session cost. Discipline-only compression has been tried and failed (numero's
 * Current State regrew to ~120 KB after the one-line-entries convention
 * shipped), so the budget is enforced at write time:
 *
 *   - post-edit size > budget          → BLOCK (exit 2) naming the compaction
 *                                        ritual as the way to make room
 *   - post-edit size > 90% of budget   → WARN (exit 0, stderr)
 *
 * Budget comes from `.indusk/config.json` `context.claude_md_budget_bytes`
 * (default 61440 = 60 KB). Raising it is a deliberate, recorded act — edit the
 * config, don't fight the hook.
 *
 * Applies to any file named CLAUDE.md (project root or sub-app) — every one of
 * them auto-loads into sessions.
 *
 * Exit 0 = allow the edit (possibly with a warning on stderr)
 * Exit 2 = block the edit (stderr sent to agent as feedback)
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { resolveStateAndGitPaths } from "./_hook-paths.js";

const DEFAULT_BUDGET_BYTES = 61440; // 60 KB
const WARN_RATIO = 0.9;

// Read hook input from stdin
let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

let event;
try {
	event = JSON.parse(input);
} catch {
	process.exit(0); // malformed event — never block on our own parse failure
}

const toolInput = event.tool_input ?? {};
const filePath = toolInput.file_path ?? "";

// Fast path: only files named CLAUDE.md
if (basename(filePath) !== "CLAUDE.md") {
	process.exit(0);
}

/** Read the budget from .indusk/config.json, walking up from the edited file. */
function readBudgetBytes(editedFilePath, eventCwd) {
	let statePath = null;
	try {
		({ statePath } = resolveStateAndGitPaths(dirname(editedFilePath)));
		if (!statePath) {
			({ statePath } = resolveStateAndGitPaths(eventCwd ?? process.cwd()));
		}
	} catch {
		// fall through to default
	}
	if (!statePath) return DEFAULT_BUDGET_BYTES;
	const configPath = join(statePath, ".indusk/config.json");
	if (!existsSync(configPath)) return DEFAULT_BUDGET_BYTES;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const v = config?.context?.claude_md_budget_bytes;
		return typeof v === "number" && v > 0 ? v : DEFAULT_BUDGET_BYTES;
	} catch {
		return DEFAULT_BUDGET_BYTES;
	}
}

/** Compute the post-edit content of the file, or null when it can't be predicted. */
function postEditContent(toolName, ti, editedFilePath) {
	if (toolName === "Write") {
		return typeof ti.content === "string" ? ti.content : null;
	}
	// Edit: apply old_string → new_string against the current on-disk content.
	// LITERAL semantics only — never String.replace(). Its replacement-string
	// $-substitution ($$, $&, $`, $') diverges from the Edit tool's literal
	// replacement, so a shell/regex snippet in new_string would make the size
	// prediction wrong in either direction (Phase 7 falsification, A16).
	if (typeof ti.old_string !== "string" || typeof ti.new_string !== "string") return null;
	if (ti.old_string === "") {
		// The Edit tool rejects empty old_string itself; predicting against it
		// (split("")/join) explodes. Nothing for us to measure.
		return null;
	}
	if (!existsSync(editedFilePath)) return null;
	let current;
	try {
		current = readFileSync(editedFilePath, "utf-8");
	} catch {
		return null;
	}
	if (!current.includes(ti.old_string)) {
		// The Edit tool will reject this call itself; nothing for us to measure.
		return null;
	}
	if (ti.replace_all) {
		// split/join is literal-safe.
		return current.split(ti.old_string).join(ti.new_string);
	}
	const idx = current.indexOf(ti.old_string);
	return current.slice(0, idx) + ti.new_string + current.slice(idx + ti.old_string.length);
}

const next = postEditContent(event.tool_name, toolInput, filePath);
if (next === null) {
	process.exit(0);
}

const budget = readBudgetBytes(filePath, event.cwd);
const size = Buffer.byteLength(next, "utf8");

if (size > budget) {
	console.error(
		`CLAUDE.md budget exceeded: this edit brings ${filePath} to ${size} bytes ` +
			`(budget ${budget}). CLAUDE.md is injected into every session — do not grow it; compact it.\n` +
			`Run \`/compact-context\` (report mode first) to compact instead of grow: it demotes shipped ` +
			`narratives to one-line rule + pointer (docs/decisions page or archived plan), moves operational ` +
			`state to .indusk/current.md, and lands the file under budget in one pass.\n` +
			`If the budget itself is wrong for this project, raise context.claude_md_budget_bytes in ` +
			`.indusk/config.json as a deliberate, recorded act.`,
	);
	process.exit(2);
}

if (size > budget * WARN_RATIO) {
	console.error(
		`CLAUDE.md budget warning: ${size} bytes is over ${Math.round(WARN_RATIO * 100)}% of the ` +
			`${budget}-byte budget. Compact soon — demote narratives to rule + pointer before the hook starts blocking.`,
	);
}

process.exit(0);
