import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { repoDir, type WorkbenchRepo } from "../../lib/worktree/repos.js";
import { git, headOf, initRepoWithCommit } from "./test-git.js";

// Re-exported: every test that builds a versioned workbench also drives git in it.
export { git, headOf };

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
 * Three layouts (plus `flat`, the legacy sibling shape with a trunk link):
 *
 *   nested   (`repos_root: "."`)   <tmp>/                 ← workbench root (git)
 *                                    ├── .indusk/config.json
 *                                    ├── .gitignore        ← ignores each repo dir
 *                                    └── code/alpha/       ← wrapped repo (git)
 *
 *   sibling  (`repos_root: <tmp>`, absolute)  <tmp>/
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

/**
 * `flat` is the legacy shape: `worktree.wrapped_repo: <name>` with no
 * `repos_root`, the checkout at `<root>/<name>`. Every reader reduces it to a
 * one-element `repos[]`; the fixture builds it so a test about "where the
 * code is" runs against the shape older workbenches still have.
 */
export type WorkbenchLayout = "nested" | "sibling" | "flat";

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

export function makeVersionedWorkbench(opts: MakeVersionedWorkbenchOptions): VersionedWorkbench {
	const layout = opts.layout ?? "nested";
	const tmp = mkdtempSync(join(tmpdir(), "versioned-wb-"));
	// The flat legacy layout is a sibling layout by another name: the canonical
	// clone lives in `sibling_parent` (the workbench's parent) and the
	// workbench root carries a trunk SYMLINK to it at `<root>/<name>` — what
	// `init --workbench` wrote through `linkTrunk` before 1.37. Every reader
	// resolves the clone through `sibling_parent`, so that is where the repo
	// goes; the link is what makes the shape flat to the eye.
	const sideBySide = layout === "sibling" || layout === "flat";
	const root = sideBySide ? join(tmp, "workbench") : tmp;
	const reposRoot = sideBySide ? tmp : root;

	const repos: FixtureRepo[] = opts.repos.map((declared) => {
		const rel = repoDir(declared as WorkbenchRepo);
		return { name: declared.name, rel, dir: join(reposRoot, rel) };
	});

	mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
	const config = {
		mode: "full",
		otel: { role: "library" },
		worktree:
			layout === "flat"
				? {
						// The legacy singular declaration, exactly as pre-1.37 init wrote it:
						// the name, and the ABSOLUTE parent the clone lives in.
						...(opts.shape ? { shape: opts.shape } : {}),
						wrapped_repo: opts.repos[0]?.name,
						sibling_parent: reposRoot,
					}
				: {
						...(opts.shape ? { shape: opts.shape } : {}),
						repos: opts.repos,
						// A sibling layout declares its parent ABSOLUTELY, as real configs do:
						// restore refuses a relative `..` (it must not escape the workbench).
						repos_root: layout === "sibling" ? reposRoot : ".",
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
	if (layout === "flat") {
		// The trunk link, as `linkTrunk` lays it: `<root>/<name>` → the clone.
		for (const repo of repos) symlinkSync(repo.dir, join(root, repo.name), "dir");
	}

	return {
		root,
		reposRoot,
		repos,
		cleanup: () => rmSync(tmp, { recursive: true, force: true }),
	};
}

/** The legacy flat shape: one repo, `alpha`, as `wrapped_repo`, checkout at `<root>/alpha`. */
export function flatLegacy(extra: Partial<MakeVersionedWorkbenchOptions> = {}): VersionedWorkbench {
	if (extra.repos && extra.repos.length !== 1) {
		throw new Error("flatLegacy declares exactly one repo — the singular shape has no list");
	}
	return makeVersionedWorkbench({
		repos: [{ name: "alpha" }],
		layout: "flat",
		shape: "workbench",
		...extra,
	});
}

/**
 * Every one-repo layout a workbench can declare, for `describe.each`: a test
 * about where the code lives runs over all four or it is blind to three.
 */
export const LAYOUTS: ReadonlyArray<[label: string, build: () => VersionedWorkbench]> = [
	["flat legacy (wrapped_repo)", () => flatLegacy()],
	[
		"nested, repo at its name",
		() =>
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "nested", shape: "workbench" }),
	],
	[
		"sibling, repo at its name",
		() =>
			makeVersionedWorkbench({ repos: [{ name: "alpha" }], layout: "sibling", shape: "workbench" }),
	],
	["nested, repo at a declared path", () => oneRepoAtPath("nested")],
];

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
export function commitFile(
	dir: string,
	rel: string,
	content: string,
	message: string,
	/** e.g. `{ GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z" }` to order commits across repos by timestamp. */
	env: NodeJS.ProcessEnv = {},
): string {
	const path = join(dir, rel);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-q", "-m", message], env);
	return headOf(dir);
}
