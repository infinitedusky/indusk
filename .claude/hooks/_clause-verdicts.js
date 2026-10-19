/**
 * The hook-side port of `src/lib/promises/clause-verdicts.ts`
 * (a-run-can-be-trusted, Decision 8): where the shell guard's decisions are
 * written, one JSON line each, and how the plan folders' state on disk is read
 * for them. A hook cannot import the TS library or the tracer, so the hooks
 * record and the package judges; this is the hooks' one copy of the writing
 * half, pinned equal to the TS by `hook-shared-modules.test.ts` — change the
 * two together.
 *
 * clause: a-plan-document-is-written-through-its-checks/shell-write-refused
 * clause: a-plan-document-is-written-through-its-checks/reads-pass
 */

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export const DECISIONS_FILE = "plan-write-decisions.jsonl";
/** Where the guard leaves a command's before-state for the witness, one file per tool use. */
export const PENDING_DIR = "plan-write-pending";

/**
 * The key that pairs the guard's line with the witness's: the payload's
 * `tool_use_id`, else a hash of the session and the command (both payloads
 * carry them), so the two hooks agree without talking.
 */
export function toolUseKey(event) {
	if (typeof event?.tool_use_id === "string" && event.tool_use_id !== "") {
		return event.tool_use_id.replace(/[^\w-]/g, "_").slice(0, 120);
	}
	const command = typeof event?.tool_input?.command === "string" ? event.tool_input.command : "";
	return createHash("sha256")
		.update(`${event?.session_id ?? ""}\0${command}`)
		.digest("hex")
		.slice(0, 32);
}

/** The nearest directory at or above `cwd` holding `.indusk/planning`, or null. */
export function planRootOf(cwd) {
	let dir = resolve(cwd);
	for (let i = 0; i < 40; i++) {
		if (existsSync(join(dir, ".indusk", "planning"))) return dir;
		const up = dirname(dir);
		if (up === dir) return null;
		dir = up;
	}
	return null;
}

/** The root-relative paths whose size or modified time differ between two snapshots, sorted. */
export function changedFiles(before, after) {
	const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
	return [...keys]
		.filter((k) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(after?.[k] ?? null))
		.sort();
}

/** Append one line to the decision file in the project's home. */
export function appendDecision(home, line) {
	mkdirSync(home, { recursive: true });
	appendFileSync(join(home, DECISIONS_FILE), `${JSON.stringify(line)}\n`);
}

/**
 * The plan folders' state: `{ "<root-relative path>": [size, mtimeMs] }` for
 * every file in every active plan folder under `<root>/.indusk/planning/`, and
 * in each archived plan named in `archived`. The whole archive is not read:
 * eight hundred files made every decision line tens of kilobytes, and a plan
 * in the archive is closed; one a command names is read.
 */
export function planFolderSnapshot(root, archived = []) {
	const planning = join(root, ".indusk", "planning");
	const out = {};
	const walk = (dir) => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.isFile()) {
				try {
					const s = statSync(p);
					out[relative(root, p)] = [s.size, Math.round(s.mtimeMs)];
				} catch {
					// gone between the read and the stat: not in the snapshot
				}
			}
		}
	};
	if (!existsSync(planning)) return out;
	for (const e of readdirSync(planning, { withFileTypes: true })) {
		if (e.isDirectory() && e.name !== "archive") walk(join(planning, e.name));
	}
	for (const plan of new Set(archived)) {
		if (plan && !plan.includes("/") && plan !== "..") walk(join(planning, "archive", plan));
	}
	return out;
}
