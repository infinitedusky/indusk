import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./test-git.js";

/**
 * A project with a plan on trunk and real git worktrees beside it — the
 * fixture admin-plan-worktrees needs, because the bug is about which checkout
 * gets read, and a fixture with one checkout cannot show it.
 *
 *   <tmp>/
 *   ├── proj/                 trunk, on main, plan `demo` committed
 *   └── <worktree dirs>       added by `addWorktree`, each on its own branch
 *
 * The plan's impl has two build phases of two implementation items each, so
 * a checkoff in a worktree changes a count a reader can see. Every step
 * throws on failure: a half-built fixture proves nothing.
 */

export const PLAN = "demo";
export const RECORD_FILE = "indusk-plan-worktrees.json";

const IMPL = `---
title: demo
status: approved
---

# demo

## Checklist

### Phase 1: First

- [ ] first item
- [ ] second item

#### Phase 1 Verification

- [ ] first check

### Phase 2: Second

- [ ] third item
- [ ] fourth item

#### Phase 2 Verification

- [ ] second check
`;

export interface PlanWorktreeProject {
	/** Realpath of the temp dir holding the trunk and every worktree. */
	base: string;
	/** Realpath of the trunk checkout. */
	trunk: string;
	/** `git worktree add <base>/<dir> -b <branch> main`; returns the worktree's realpath. */
	addWorktree(dir: string, branch: string): string;
	/** Check off `item` in `checkout`'s copy of the demo impl (uncommitted, like a working agent's edit). */
	checkOff(checkout: string, item: string): void;
	/** Set the demo impl's frontmatter status in `checkout`'s copy. */
	setImplStatus(checkout: string, status: string): void;
	/** Append a phase-boundary record opening build phase `phase` in `checkout`. */
	openPhase(checkout: string, phase: number): void;
	/** The shared git directory every checkout of this repository reads. */
	commonDir(): string;
	/** Write the assignment record by hand — raw text, for the malformed and doubled cases. */
	writeRecordRaw(text: string): void;
	/** Write a well-formed record assigning each `{plan, path, branch}`. */
	writeRecord(assignments: { plan: string; path: string; branch: string }[]): void;
	/** The record's text, or null when it does not exist. */
	readRecord(): string | null;
	cleanup(): void;
}

export function planWorktreeProject(prefix = "plan-wt"): PlanWorktreeProject {
	const base = realpathSync(mkdtempSync(join(tmpdir(), `${prefix}-`)));
	const trunk = join(base, "proj");
	mkdirSync(join(trunk, ".indusk", "planning", PLAN), { recursive: true });
	git(trunk, ["init", "-q", "-b", "main"]);
	writeFileSync(
		join(trunk, ".indusk", "config.json"),
		`${JSON.stringify({ mode: "full" }, null, 2)}\n`,
	);
	writeFileSync(
		join(trunk, ".indusk", "planning", PLAN, "brief.md"),
		"---\ntitle: demo\nstatus: accepted\n---\n\n# demo\n",
	);
	writeFileSync(join(trunk, ".indusk", "planning", PLAN, "impl.md"), IMPL);
	git(trunk, ["add", "-A"]);
	git(trunk, ["commit", "-q", "-m", "plan demo"]);

	const implIn = (checkout: string) => join(checkout, ".indusk", "planning", PLAN, "impl.md");
	const commonDir = () => {
		const out = git(trunk, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
		return realpathSync(out);
	};

	return {
		base,
		trunk,
		addWorktree(dir, branch) {
			const path = join(base, dir);
			git(trunk, ["worktree", "add", "-q", path, "-b", branch, "main"]);
			return realpathSync(path);
		},
		checkOff(checkout, item) {
			const text = readFileSync(implIn(checkout), "utf-8");
			const next = text.replace(`- [ ] ${item}`, `- [x] ${item}`);
			if (next === text) throw new Error(`fixture: no unchecked "${item}" in ${implIn(checkout)}`);
			writeFileSync(implIn(checkout), next);
		},
		setImplStatus(checkout, status) {
			const text = readFileSync(implIn(checkout), "utf-8");
			const next = text.replace(/^status: .*$/m, `status: ${status}`);
			if (next === text) throw new Error(`fixture: status line unchanged in ${implIn(checkout)}`);
			writeFileSync(implIn(checkout), next);
		},
		openPhase(checkout, phase) {
			const sha = git(checkout, ["rev-parse", "HEAD"]);
			const line = JSON.stringify({
				plan: PLAN,
				phase,
				kind: "build",
				sha,
				at: new Date().toISOString(),
			});
			const file = join(checkout, ".indusk", "phase-boundary.jsonl");
			let prior = "";
			try {
				prior = readFileSync(file, "utf-8");
			} catch {
				prior = "";
			}
			writeFileSync(file, `${prior}${line}\n`);
		},
		commonDir,
		writeRecordRaw(text) {
			writeFileSync(join(commonDir(), RECORD_FILE), text);
		},
		writeRecord(assignments) {
			const at = new Date().toISOString();
			const body = { version: 1, assignments: assignments.map((a) => ({ ...a, at })) };
			writeFileSync(join(commonDir(), RECORD_FILE), `${JSON.stringify(body, null, 2)}\n`);
		},
		readRecord() {
			try {
				return readFileSync(join(commonDir(), RECORD_FILE), "utf-8");
			} catch {
				return null;
			}
		},
		cleanup() {
			rmSync(base, { recursive: true, force: true });
		},
	};
}
