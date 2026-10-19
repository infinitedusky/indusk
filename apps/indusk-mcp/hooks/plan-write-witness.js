#!/usr/bin/env node
/**
 * PostToolUse hook (Bash): records what the plan folders hold after a shell
 * command, beside the decision `plan-write-guard.js` recorded before it
 * (a-run-can-be-trusted, Decision 8).
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 * clause: a-plan-document-is-written-through-its-checks/reads-pass
 *
 * The guard left the plan folders' state before the command in the project's
 * home (`plan-write-pending/<tool use>.json`), with the checkout it read. This
 * reads the same checkout's state now (never the payload's `cwd`, which is
 * where the command left the shell)
 * and appends `{ kind: "after", toolUseId, after }` to the decision file for a
 * command the guard recorded; for one it did not (it named no plan path), it
 * records the command only when a plan document changed under it, which is how
 * a script the guard cannot read is seen (U1). It judges nothing: the package
 * judges the pair (`lib/promises/clause-verdicts.ts`).
 *
 * Refuses nothing and says nothing; always exits 0.
 */

import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	appendDecision,
	changedFiles,
	PENDING_DIR,
	planFolderSnapshot,
	planRootOf,
	toolUseKey,
} from "./_clause-verdicts.js";
import { projectHome } from "./_hook-paths.js";

function witness(event) {
	if (event?.tool_name !== "Bash") return;
	const cwd = typeof event.cwd === "string" && event.cwd !== "" ? event.cwd : process.cwd();
	const root = planRootOf(cwd);
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
	const { named, archived: _archived, ...decision } = pending;
	if (named) {
		appendDecision(home, { kind: "after", toolUseId: key, after });
		return;
	}
	if (changedFiles(decision.before, after).length === 0) return;
	appendDecision(home, decision);
	appendDecision(home, { kind: "after", toolUseId: key, after });
}

let input = "";
try {
	for await (const chunk of process.stdin) input += chunk;
	witness(JSON.parse(input));
} catch {
	// A witness that cannot read its input records nothing; it never fails the command.
}
process.exit(0);
