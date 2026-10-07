import { spawnSync } from "node:child_process";
import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import { bookkeepingRoots, evalDir } from "./roots.js";

/**
 * Move a project's machine state out of its main checkout and into its home
 * (bookkeeping-lives-where-it-is-read D5), run by `indusk update`. The tracked
 * highlights queue and processed list are merged into the home by id, so
 * nothing already there is duplicated and every unprocessed highlight stays
 * unprocessed; then they leave git and the checkout. `.indusk/eval/` is moved
 * too, its logs appended. Returns what was moved, for the update's report.
 *
 * promise: indusk-leaves-main-clean
 */
export function migrateBookkeeping(anyCheckout: string): string[] {
	const { trunk, home } = bookkeepingRoots(anyCheckout);
	const moved: string[] = [];
	for (const name of ["highlights.jsonl", "highlights-processed.jsonl"]) {
		const rel = join(".indusk", name);
		const src = join(trunk, rel);
		if (!existsSync(src)) continue;
		mkdirSync(home, { recursive: true });
		mergeJsonlById(src, join(home, name));
		untrack(trunk, rel);
		rmSync(src);
		moved.push(rel);
	}
	const oldEval = join(trunk, ".indusk", "eval");
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
		untrack(trunk, join(".indusk", "eval"));
		rmSync(oldEval, { recursive: true, force: true });
		moved.push(join(".indusk", "eval/"));
	}
	return moved;
}

/** Append `src`'s records to `dest`, skipping any whose id `dest` already has. */
function mergeJsonlById(src: string, dest: string): void {
	const have = new Set<string>();
	const seenLines = new Set<string>();
	if (existsSync(dest)) {
		for (const line of readFileSync(dest, "utf-8").split("\n")) {
			if (line.trim() === "") continue;
			seenLines.add(line);
			const id = idOf(line);
			if (id) have.add(id);
		}
	}
	const add: string[] = [];
	for (const line of readFileSync(src, "utf-8").split("\n")) {
		if (line.trim() === "" || seenLines.has(line)) continue;
		const id = idOf(line);
		if (id && have.has(id)) continue;
		if (id) have.add(id);
		seenLines.add(line);
		add.push(line);
	}
	if (add.length > 0) appendFileSync(dest, `${add.join("\n")}\n`);
}

function idOf(line: string): string | null {
	try {
		const id = (JSON.parse(line) as { id?: unknown }).id;
		return typeof id === "string" ? id : null;
	} catch {
		return null;
	}
}

/** Take a path out of git's index, if it is tracked; the file itself is the caller's. */
function untrack(trunk: string, rel: string): void {
	const tracked = spawnSync("git", ["ls-files", "--", rel], { cwd: trunk, encoding: "utf-8" });
	if (tracked.status === 0 && tracked.stdout.trim() !== "") {
		spawnSync("git", ["rm", "-r", "-q", "--cached", "--", rel], { cwd: trunk });
	}
}
