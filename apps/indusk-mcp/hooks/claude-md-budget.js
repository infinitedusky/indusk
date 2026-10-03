#!/usr/bin/env node
/**
 * PreToolUse hook: CLAUDE.md size budget (indusk-makeover Phase 2;
 * context-tiers Build Phase 1).
 *
 * CLAUDE.md is injected into every session — its size is the multiplier on all
 * session cost. Discipline-only compression has been tried and failed (numero's
 * Current State regrew to ~120 KB after the one-line-entries convention
 * shipped), so the budget is enforced at write time — on GROWTH, not size:
 *
 *   - the edit does not grow the file     → ALLOW, at any size. A file already
 *                                           over budget must be able to get
 *                                           smaller, or the plan that shrinks
 *                                           it cannot run (found 2026-10-02:
 *                                           the hook refused a shrinking edit).
 *   - post-edit size > its budget         → BLOCK (exit 2) naming the
 *                                           compaction ritual
 *   - post-edit size > 90% of its budget  → WARN (exit 0, stderr)
 *
 * Two budgets, from `.indusk/config.json`:
 *   - `context.claude_md_budget_bytes` (default 61440 = 60 KB) for a ROOT
 *     context file — the project root's, or, in a workbench, a declared repo's
 *     own root `CLAUDE.md`, which sits below the state root but is that
 *     repository's always-loaded file.
 *   - `context.nested_claude_md_budget_bytes` (default 16384 = 16 KB) for any
 *     other file named CLAUDE.md — an area's rules, loaded only when a file in
 *     that area is read.
 * Raising either is a deliberate, recorded act — edit the config, don't fight
 * the hook.
 *
 * Exit 0 = allow the edit (possibly with a warning on stderr)
 * Exit 2 = block the edit (stderr sent to agent as feedback)
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { declaredRepoDirsAt, resolveStateAndGitPaths, samePath } from "./_hook-paths.js";

const DEFAULT_ROOT_BUDGET_BYTES = 61440; // 60 KB
const DEFAULT_NESTED_BUDGET_BYTES = 16384; // 16 KB
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

/** The InDusk state root governing the edited file: walk up from it, else from the event cwd. */
function resolveStatePath(editedFilePath, eventCwd) {
	try {
		const { statePath } = resolveStateAndGitPaths(dirname(editedFilePath));
		if (statePath) return statePath;
		return resolveStateAndGitPaths(eventCwd ?? process.cwd()).statePath ?? null;
	} catch {
		return null;
	}
}

/** Both budgets from the config under `statePath`, defaults where unset. */
function readBudgets(statePath) {
	const budgets = { root: DEFAULT_ROOT_BUDGET_BYTES, nested: DEFAULT_NESTED_BUDGET_BYTES };
	if (!statePath) return budgets;
	const configPath = join(statePath, ".indusk/config.json");
	if (!existsSync(configPath)) return budgets;
	try {
		const context = JSON.parse(readFileSync(configPath, "utf-8"))?.context ?? {};
		if (typeof context.claude_md_budget_bytes === "number" && context.claude_md_budget_bytes > 0) {
			budgets.root = context.claude_md_budget_bytes;
		}
		if (
			typeof context.nested_claude_md_budget_bytes === "number" &&
			context.nested_claude_md_budget_bytes > 0
		) {
			budgets.nested = context.nested_claude_md_budget_bytes;
		}
	} catch {
		// unreadable config — defaults
	}
	return budgets;
}

/**
 * A root context file lives in the state root's directory, in a declared
 * repo's checkout directory, or at the top of any git checkout. Judged by
 * directory identity, never by depth: in a workbench the wrapped repo's root
 * `CLAUDE.md` is below the state root and is still that repository's root
 * file — and so is the same file in a plan worktree of that repo, which no
 * declaration names (context-tiers A20). `.git` marks a checkout's top: a
 * directory in a clone, a file in a worktree.
 */
function isRootContextFile(editedFilePath, statePath) {
	if (!statePath) return true; // no project to be nested in — the root budget is the safer reading
	const dir = dirname(editedFilePath);
	if (samePath(dir, statePath)) return true;
	if (existsSync(join(dir, ".git"))) return true;
	return declaredRepoDirsAt(statePath).some((repoDir) => samePath(dir, repoDir));
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

/** The file's size on disk now, or 0 when it does not exist yet. */
function currentSize(editedFilePath) {
	try {
		return existsSync(editedFilePath) ? Buffer.byteLength(readFileSync(editedFilePath), "utf8") : 0;
	} catch {
		return 0;
	}
}

const next = postEditContent(event.tool_name, toolInput, filePath);
if (next === null) {
	process.exit(0);
}

const size = Buffer.byteLength(next, "utf8");
const before = currentSize(filePath);
if (size <= before) {
	// Not growth. A shrinking edit is how an over-budget file gets under budget;
	// refusing it leaves the file over budget forever.
	process.exit(0);
}

const statePath = resolveStatePath(filePath, event.cwd);
const budgets = readBudgets(statePath);
const root = isRootContextFile(filePath, statePath);
const budget = root ? budgets.root : budgets.nested;
const key = root ? "context.claude_md_budget_bytes" : "context.nested_claude_md_budget_bytes";
const kind = root ? "root context file" : "nested context file";

if (size > budget) {
	console.error(
		`CLAUDE.md budget exceeded: this edit brings ${filePath} to ${size} bytes ` +
			`(${kind}; budget ${budget}, ${key}). CLAUDE.md is loaded into sessions — do not grow it; compact it.\n` +
			`A shrinking edit is always allowed, so make room first: ` +
			(root
				? `run \`/compact-context\` (report mode first) — it demotes shipped narratives to one-line rule + pointer ` +
					`(docs/decisions page or archived plan), moves operational state to .indusk/current.md, and lands the file under budget in one pass.\n`
				: `move what this area no longer needs behind a pointer, or into an enforcer that names its lesson.\n`) +
			`If the budget itself is wrong for this project, raise ${key} in .indusk/config.json as a deliberate, recorded act.`,
	);
	process.exit(2);
}

if (size > budget * WARN_RATIO) {
	console.error(
		`CLAUDE.md budget warning: ${size} bytes is over ${Math.round(WARN_RATIO * 100)}% of the ` +
			`${budget}-byte ${kind} budget (${key}). Compact soon — demote narratives to rule + pointer before the hook starts blocking.`,
	);
}

process.exit(0);
