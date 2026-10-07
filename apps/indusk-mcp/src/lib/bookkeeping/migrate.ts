import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { bookkeepingRoots, evalDir } from "./roots.js";

/**
 * Move a project's machine state out of its checkouts and into its home
 * (bookkeeping-lives-where-it-is-read D5), run by `indusk update`. Every
 * checkout is read — the main one and each plan worktree, whose sessions kept
 * their own queue (A15) — and merged into the home: a highlight already there
 * is recognised by what it says, not its id, since each checkout numbered its
 * own; one whose id is taken by a different highlight gets a new id, and that
 * checkout's processed marks follow it. So nothing is duplicated, every
 * unprocessed highlight stays unprocessed, and running it twice changes
 * nothing. The main checkout's files then leave git and the checkout; a
 * worktree's are left for its branch to land (`plans land` takes them out).
 * `.indusk/eval/` is moved from each, its logs appended. Returns what was
 * moved, for the update's report.
 *
 * promise: indusk-leaves-main-clean
 */
export function migrateBookkeeping(anyCheckout: string): string[] {
	const { trunk, home } = bookkeepingRoots(anyCheckout);
	const moved: string[] = [];
	for (const checkout of checkoutsOf(trunk)) {
		const isTrunk = checkout === trunk;
		const label = (rel: string) => (isTrunk ? rel : join(relative(trunk, checkout), rel));
		const queue = join(checkout, ".indusk", "highlights.jsonl");
		const processed = join(checkout, ".indusk", "highlights-processed.jsonl");
		if (existsSync(queue) || existsSync(processed)) mkdirSync(home, { recursive: true });
		const renamed = existsSync(queue)
			? mergeQueue(queue, join(home, "highlights.jsonl"))
			: new Map();
		if (existsSync(processed)) {
			mergeProcessed(processed, join(home, "highlights-processed.jsonl"), renamed);
		}
		for (const [file, name] of [
			[queue, "highlights.jsonl"],
			[processed, "highlights-processed.jsonl"],
		] as const) {
			if (!existsSync(file)) continue;
			if (isTrunk) {
				untrack(trunk, join(".indusk", name));
				rmSync(file);
			}
			moved.push(label(join(".indusk", name)));
		}
		const oldEval = join(checkout, ".indusk", "eval");
		if (existsSync(oldEval) && statSync(oldEval).isDirectory()) {
			const dest = evalDir(anyCheckout);
			mkdirSync(dest, { recursive: true });
			for (const entry of readdirSync(oldEval)) {
				const from = join(oldEval, entry);
				if (!statSync(from).isFile()) continue;
				const to = join(dest, entry);
				if (entry.endsWith(".log") || entry.endsWith(".jsonl")) {
					appendFileSync(to, readFileSync(from));
				} else if (!existsSync(to)) {
					copyFileSync(from, to);
				}
			}
			if (isTrunk) untrack(trunk, join(".indusk", "eval"));
			rmSync(oldEval, { recursive: true, force: true });
			moved.push(label(join(".indusk", "eval/")));
		}
	}
	return moved;
}

/** The main checkout first, then every worktree git lists for it. */
function checkoutsOf(trunk: string): string[] {
	const r = spawnSync("git", ["worktree", "list", "--porcelain"], {
		cwd: trunk,
		encoding: "utf-8",
	});
	const listed =
		r.status === 0
			? r.stdout
					.split("\n")
					.filter((l) => l.startsWith("worktree "))
					.map((l) => l.slice("worktree ".length))
					.filter((p) => existsSync(p))
			: [];
	return [trunk, ...listed.filter((p) => realpathSync(p) !== realpathSync(trunk))];
}

type Row = Record<string, unknown> & { id?: unknown };

function rowsOf(path: string): Row[] {
	if (!existsSync(path)) return [];
	const rows: Row[] = [];
	for (const line of readFileSync(path, "utf-8").split("\n")) {
		if (line.trim() === "") continue;
		try {
			rows.push(JSON.parse(line) as Row);
		} catch {
			// a malformed line was unreadable where it was, too
		}
	}
	return rows;
}

/** A highlight is the same highlight when it says the same thing at the same time. */
const sameness = (h: Row) => JSON.stringify([h.timestamp, h.tag, h.level, h.note]);

/**
 * Append `src`'s highlights to `dest`, skipping any `dest` already holds;
 * returns the ids it had to change, old to new, because a different highlight
 * already had them.
 */
function mergeQueue(src: string, dest: string): Map<string, string> {
	const have = rowsOf(dest);
	const seen = new Set(have.map(sameness));
	const ids = new Set(have.map((h) => h.id).filter((id): id is string => typeof id === "string"));
	const renamed = new Map<string, string>();
	const add: string[] = [];
	for (const h of rowsOf(src)) {
		if (seen.has(sameness(h))) continue;
		if (typeof h.id === "string" && ids.has(h.id)) {
			let n = 1;
			while (ids.has(`${h.id}-m${n}`)) n++;
			renamed.set(h.id, `${h.id}-m${n}`);
			h.id = `${h.id}-m${n}`;
		}
		if (typeof h.id === "string") ids.add(h.id);
		seen.add(sameness(h));
		add.push(JSON.stringify(h));
	}
	if (add.length > 0) appendFileSync(dest, `${add.join("\n")}\n`);
	return renamed;
}

/** Append `src`'s marks to `dest` under their highlights' ids in the home, skipping ids `dest` has marked. */
function mergeProcessed(src: string, dest: string, renamed: Map<string, string>): void {
	const marked = new Set(rowsOf(dest).map((m) => m.id));
	const add: string[] = [];
	for (const m of rowsOf(src)) {
		if (typeof m.id === "string") m.id = renamed.get(m.id) ?? m.id;
		if (marked.has(m.id)) continue;
		marked.add(m.id);
		add.push(JSON.stringify(m));
	}
	if (add.length > 0) appendFileSync(dest, `${add.join("\n")}\n`);
}

/** Take a path out of git's index, if it is tracked; the file itself is the caller's. */
function untrack(trunk: string, rel: string): void {
	const tracked = spawnSync("git", ["ls-files", "--", rel], { cwd: trunk, encoding: "utf-8" });
	if (tracked.status === 0 && tracked.stdout.trim() !== "") {
		spawnSync("git", ["rm", "-r", "-q", "--cached", "--", rel], { cwd: trunk });
	}
}
