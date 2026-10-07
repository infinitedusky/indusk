import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A project with a main checkout on `main` and one plan worktree, and an InDusk home of its own. */
export interface Fixture {
	main: string;
	worktree: string;
	home: string;
	git(cwd: string, ...args: string[]): string;
	cleanup(): void;
}

export function makeFixture(): Fixture {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "bookkeeping-")));
	const main = join(base, "proj");
	const worktree = join(base, "proj-plan");
	const home = join(base, "home");
	const git = (cwd: string, ...args: string[]) =>
		execFileSync("git", args, {
			cwd,
			encoding: "utf-8",
			env: {
				...process.env,
				GIT_AUTHOR_NAME: "t",
				GIT_AUTHOR_EMAIL: "t@t",
				GIT_COMMITTER_NAME: "t",
				GIT_COMMITTER_EMAIL: "t@t",
			},
		}).trim();
	execFileSync("mkdir", ["-p", main, home]);
	git(main, "init", "-q", "-b", "main");
	writeFileSync(join(main, "README.md"), "x\n");
	git(main, "add", "-A");
	git(main, "commit", "-qm", "init");
	git(main, "worktree", "add", "-q", "-b", "plan/x", worktree);
	const previous = process.env.INDUSK_HOME;
	process.env.INDUSK_HOME = home;
	return {
		main,
		worktree,
		home,
		git,
		cleanup: () => {
			if (previous === undefined) delete process.env.INDUSK_HOME;
			else process.env.INDUSK_HOME = previous;
			rmSync(base, { recursive: true, force: true });
		},
	};
}
