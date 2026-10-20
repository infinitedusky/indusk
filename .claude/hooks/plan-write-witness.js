#!/usr/bin/env node
/**
 * PostToolUse hook (Bash, and Edit|Write): records what
 * the plan folders hold after a shell command, beside the decision
 * `plan-write-guard.js` recorded before it (a-run-can-be-trusted, Decision 8),
 * and each editing-tool write to a plan document made while a shell command is
 * in flight.
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 * clause: a-plan-document-is-written-through-its-checks/reads-pass
 *
 * The guard left the plan folders' state before the command in the project's
 * home (`plan-write-pending/<tool use>.json`), with the checkout it read. This
 * reads the same checkout's state now (never the payload's `cwd`, which is
 * where the command left the shell, A99) and appends
 * `{ kind: "after", toolUseId, at, after }` to the decision file for a command
 * the guard recorded; for one it did not (it named no plan path), it records
 * the command only when a plan document changed under it, which is how a
 * script the guard cannot read is seen (U1).
 *
 * Claude Code runs one turn's tool calls at once, so an Edit of a plan document
 * can land while a shell command runs. For an editing tool's payload whose file
 * is in a plan folder, while any shell command's pending file exists, it
 * appends `{ kind: "tool-write", at, root, file, stat }`; the drain leaves such
 * a change out of the shell command's (A100). It judges nothing: the package
 * judges the lines (`lib/promises/clause-verdicts.ts`).
 *
 * Refuses nothing and says nothing; always exits 0.
 */

import { readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
	appendDecision,
	changedFiles,
	PENDING_DIR,
	planFolderSnapshot,
	planRootOf,
	toolUseKey,
} from "./_clause-verdicts.js";
import { projectHome } from "./_hook-paths.js";

const EDITING_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
/** A file in a plan's folder, root-relative: `.indusk/planning/[archive/]<plan>/…`. */
const IN_PLAN_FOLDER = /^\.indusk\/planning\/(?:archive\/)?[^/]+\/.+/;

function eventCwd(event) {
	return typeof event.cwd === "string" && event.cwd !== "" ? event.cwd : process.cwd();
}

function witnessShell(event) {
	const root = planRootOf(eventCwd(event));
	if (!root) return;
	const home = projectHome(root);
	const key = toolUseKey(event);
	const path = join(home, PENDING_DIR, `${key}.json`);
	let pending;
	try {
		pending = JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return; // nothing recorded before this command
	}
	rmSync(path, { force: true });
	// The checkout the guard looked at, never the one the command left the shell in: a command
	// that starts with `cd` into another checkout of the project ends there (A99).
	const looked = typeof pending.root === "string" && pending.root !== "" ? pending.root : root;
	const after = planFolderSnapshot(looked, pending.archived ?? []);
	const at = new Date().toISOString();
	const { named, archived: _archived, ...decision } = pending;
	if (named) {
		appendDecision(home, { kind: "after", toolUseId: key, at, after });
		return;
	}
	if (changedFiles(decision.before, after).length === 0) return;
	appendDecision(home, decision);
	appendDecision(home, { kind: "after", toolUseId: key, at, after });
}

function witnessToolWrite(event) {
	const input = event.tool_input ?? {};
	const named = input.file_path ?? input.notebook_path;
	if (typeof named !== "string" || named === "") return;
	const file = resolve(eventCwd(event), named);
	const root = planRootOf(dirname(file));
	if (!root) return;
	const rel = relative(root, file).replace(/\\/g, "/");
	if (!IN_PLAN_FOLDER.test(rel)) return;
	const home = projectHome(root);
	// Only while a shell command is in flight: with none, there is nothing to blame it on.
	let inFlight = false;
	try {
		inFlight = readdirSync(join(home, PENDING_DIR)).some((n) => n.endsWith(".json"));
	} catch {
		// no pending folder: no shell command recorded
	}
	if (!inFlight) return;
	let stat = null;
	try {
		const s = statSync(file);
		stat = [s.size, Math.round(s.mtimeMs)];
	} catch {
		// the tool removed it, or it is not there yet: a change the drain cannot excuse
	}
	appendDecision(home, { kind: "tool-write", at: new Date().toISOString(), root, file: rel, stat });
}

function witness(event) {
	if (event?.tool_name === "Bash") witnessShell(event);
	else if (EDITING_TOOLS.has(event?.tool_name)) witnessToolWrite(event);
}

let input = "";
try {
	for await (const chunk of process.stdin) input += chunk;
	witness(JSON.parse(input));
} catch {
	// A witness that cannot read its input records nothing; it never fails the command.
}
process.exit(0);
