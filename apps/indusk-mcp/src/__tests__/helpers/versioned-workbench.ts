import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repoDir, type WorkbenchRepo } from "../../lib/worktree/repos.js";

/**
 * A *versioned* workbench, the shape every real project has had since 1.37.0:
 * the workbench root is itself a git repository, and the repos it wraps are
 * declared in `worktree.repos[]` with an optional `path` / `worktrees` each.
 *
 * The regression net never had this fixture. `worktree-fixture.ts` builds the
 * pre-1.37 shape (root never `git init`ed, singular `wrapped_repo`), which is why
 * none of the workbench-trust-fixes findings could be seen by a test: every
 * one of them appears only once the root becomes a repository.
 *
 * Two layouts:
 *
 *   nested   (`repos_root: "."`)   <tmp>/                 ← workbench root (git)
 *                                    ├── .indusk/config.json
 *                                    ├── .gitignore        ← ignores each repo dir
 *                                    └── code/alpha/       ← wrapped repo (git)
 *
 *   sibling  (`repos_root: ".."`)  <tmp>/
 *                                    ├── workbench/        ← workbench root (git)
 *                                    │   └── .indusk/config.json
 *                                    └── code/alpha/       ← wrapped repo (git)
 *
 * Repo directories come from the production `repoDir` (declared `path`, else
 * `name`) so this file never restates that rule.
 */

export interface DeclaredRepo {
	name: string;
	path?: string;
	worktrees?: string;
	remote?: string;
}

export type WorkbenchLayout = "nested" | "sibling";

export interface FixtureRepo {
	name: string;
	/** `repoDir(repo)`: the declared `path`, else the name. */
	rel: string;
	/** Absolute checkout directory. */
	dir: string;
}

export interface VersionedWorkbench {
	/** The workbench root — a git repository. */
	root: string;
	/** Where the declared repos live (absolute). */
	reposRoot: string;
	repos: FixtureRepo[];
	cleanup(): void;
}

export interface MakeVersionedWorkbenchOptions {
	repos: DeclaredRepo[];
	layout?: WorkbenchLayout;
	/**
	 * Omit `shape` to build the config `isWorkbench` cannot see today: repos
	 * declared, shape flag absent (test-plan A14).
	 */
	shape?: "workbench";
	/** Skip `git init` for the wrapped repos (restore tests clone them). */
	initRepos?: boolean;
	/** Merged over the generated `.indusk/config.json`. */
	extraConfig?: Record<string, unknown>;
}

const TEST_GIT_ENV = {
	GIT_AUTHOR_NAME: "test",
	GIT_AUTHOR_EMAIL: "test@test.local",
	GIT_COMMITTER_NAME: "test",
	GIT_COMMITTER_EMAIL: "test@test.local",
};

/** Run git and throw on a non-zero exit — a fixture that half-builds proves nothing. */
export function git(cwd: string, args: string[]): string {
	const r = spawnSync("git", args, {
		cwd,
		env: { ...process.env, ...TEST_GIT_ENV },
		encoding: "utf-8",
	});
	if (r.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed (cwd=${cwd}, code=${r.status}): ${r.stderr}`);
	}
	return r.stdout.trim();
}

export function headOf(dir: string): string {
	return git(dir, ["rev-parse", "HEAD"]);
}

function initRepoWithCommit(dir: string, label: string): void {
	mkdirSync(dir, { recursive: true });
	git(dir, ["init", "-q", "-b", "main"]);
	writeFileSync(join(dir, "README.md"), `# ${label}\n`);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-q", "-m", `init ${label}`]);
}

export function makeVersionedWorkbench(opts: MakeVersionedWorkbenchOptions): VersionedWorkbench {
	const layout = opts.layout ?? "nested";
	const tmp = mkdtempSync(join(tmpdir(), "versioned-wb-"));
	const root = layout === "sibling" ? join(tmp, "workbench") : tmp;
	const reposRoot = layout === "sibling" ? tmp : root;

	const repos: FixtureRepo[] = opts.repos.map((declared) => {
		const rel = repoDir(declared as WorkbenchRepo);
		return { name: declared.name, rel, dir: join(reposRoot, rel) };
	});

	mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
	const config = {
		mode: "full",
		otel: { role: "library" },
		worktree: {
			...(opts.shape ? { shape: opts.shape } : {}),
			repos: opts.repos,
			repos_root: layout === "sibling" ? ".." : ".",
		},
		...(opts.extraConfig ?? {}),
	};
	writeFileSync(join(root, ".indusk", "config.json"), `${JSON.stringify(config, null, 2)}\n`);

	// The workbench's own git must never track the wrapped code — one precise
	// line per declared location, the way the real scaffolding writes it.
	const ignore = repos.map((r) => `/${r.rel}/`).join("\n");
	writeFileSync(join(root, ".gitignore"), `${ignore}\n`);

	initRepoWithCommit(root, "workbench");

	if (opts.initRepos !== false) {
		for (const repo of repos) initRepoWithCommit(repo.dir, repo.name);
	}

	return {
		root,
		reposRoot,
		repos,
		cleanup: () => rmSync(tmp, { recursive: true, force: true }),
	};
}

/** One repo, `alpha`, declared at `path: "code/alpha"`. */
export function oneRepoAtPath(
	layout: WorkbenchLayout = "nested",
	extra: Partial<MakeVersionedWorkbenchOptions> = {},
): VersionedWorkbench {
	return makeVersionedWorkbench({
		repos: [{ name: "alpha", path: "code/alpha" }],
		layout,
		shape: "workbench",
		...extra,
	});
}

/** Two repos, `alpha` and `beta`, at their names. */
export function twoRepos(
	layout: WorkbenchLayout = "nested",
	extra: Partial<MakeVersionedWorkbenchOptions> = {},
): VersionedWorkbench {
	return makeVersionedWorkbench({
		repos: [{ name: "alpha" }, { name: "beta" }],
		layout,
		shape: "workbench",
		...extra,
	});
}

/** Drop a plan's `impl.md` into the workbench's planning dir; returns its path. */
export function writePlan(wb: VersionedWorkbench, name: string, impl: string): string {
	const dir = join(wb.root, ".indusk", "planning", name);
	mkdirSync(dir, { recursive: true });
	const path = join(dir, "impl.md");
	writeFileSync(path, impl);
	return path;
}

/** Write a file under a repo checkout and commit it there. */
export function commitFile(dir: string, rel: string, content: string, message: string): string {
	const path = join(dir, rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-q", "-m", message]);
	return headOf(dir);
}
