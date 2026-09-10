import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { git } from "./cli.js";

/**
 * Fixtures for the papers surface: a plan folder of frontmatter-bearing
 * documents, a git-initialized project around one, and a destination repo
 * with an index page carrying the marker pair the publish step rewrites
 * between.
 *
 * Everything here is written to the filesystem and, where it matters,
 * committed — the tests reach the publish step over the CLI boundary, so the
 * fixture has to look like a real project and a real site, not a mock.
 */

// One definition: the marker pair the publish step rewrites between.
import { INDEX_MARKERS } from "../../lib/papers/index-page.js";

export { INDEX_MARKERS };

export interface DocSpec {
	frontmatter: Record<string, unknown>;
	body: string;
}

/** Write `docs` into `dir` as frontmatter + body, creating the directory. */
export function writeDocs(dir: string, docs: Record<string, DocSpec>): void {
	mkdirSync(dir, { recursive: true });
	for (const [file, { frontmatter, body }] of Object.entries(docs)) {
		writeFileSync(join(dir, file), matter.stringify(body, frontmatter));
	}
}

/** A plan folder alone, under a throwaway project root. For parser tests. */
export function planFolder(docs: Record<string, DocSpec>, plan = "essays"): string {
	const root = mkdtempSync(join(tmpdir(), "papers-plan-"));
	const dir = join(root, ".indusk/planning", plan);
	writeDocs(dir, docs);
	return dir;
}

export interface PaperProject {
	root: string;
	plan: string;
	planDir: string;
}

/**
 * A git-initialized project with `.indusk/config.json` and one plan folder,
 * committed on `main` unless `commit: false`. `config` is merged over a
 * minimal full-mode config.
 */
export function paperProject(opts: {
	plan?: string;
	docs: Record<string, DocSpec>;
	config?: Record<string, unknown>;
	commit?: boolean;
}): PaperProject {
	const root = mkdtempSync(join(tmpdir(), "papers-project-"));
	const plan = opts.plan ?? "essays";
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(
		join(root, ".indusk/config.json"),
		`${JSON.stringify({ mode: "full", ...(opts.config ?? {}) }, null, "\t")}\n`,
	);
	const planDir = join(root, ".indusk/planning", plan);
	writeDocs(planDir, opts.docs);
	git(root, ["init", "-q", "-b", "main"]);
	if (opts.commit !== false) {
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "plan"]);
	}
	return { root, plan, planDir };
}

export interface DestinationRepo {
	root: string;
	/** Directory pages land in, relative to root. */
	dir: string;
	/** Index page, relative to root. */
	index: string;
}

/**
 * A destination: a directory with `<dir>/index.md` carrying the marker pair,
 * git-initialized and committed unless `git: false`. Pass `at` to place it
 * somewhere specific (a workbench's declared repo path).
 */
export function destinationRepo(
	opts: { withMarkers?: boolean; git?: boolean; dir?: string; at?: string } = {},
): DestinationRepo {
	const root = opts.at ?? mkdtempSync(join(tmpdir(), "papers-dest-"));
	const dir = opts.dir ?? "writing";
	mkdirSync(join(root, dir), { recursive: true });
	const index = join(dir, "index.md");
	const markers = opts.withMarkers === false ? "" : `\n${INDEX_MARKERS[0]}\n${INDEX_MARKERS[1]}\n`;
	writeFileSync(join(root, index), `# Writing\n${markers}`);
	if (opts.git !== false) {
		git(root, ["init", "-q", "-b", "main"]);
		git(root, ["add", "-A"]);
		git(root, ["commit", "-q", "-m", "site"]);
	}
	return { root, dir, index };
}

/** The `papers` config block pointing at `dest` by path. */
export function blogConfig(dest: DestinationRepo, name = "blog"): Record<string, unknown> {
	return {
		papers: { destinations: [{ name, path: dest.root, dir: dest.dir, index: dest.index }] },
	};
}

/** argv for `indusk papers publish <plan>/<file> …`. */
export function publishArgs(plan: string, file: string, ...extra: string[]): string[] {
	return ["papers", "publish", `${plan}/${file}`, ...extra];
}

/** The block a publish owns: everything between the index's marker pair. */
export function indexBlock(dest: { root: string; index: string }): string {
	const text = readFileSync(join(dest.root, dest.index), "utf-8");
	return text.split(INDEX_MARKERS[0])[1]?.split(INDEX_MARKERS[1])[0] ?? "";
}

/** Commits reachable from HEAD, 0 for an empty repo. */
export function commitCount(repo: string): number {
	const out = git(repo, ["rev-list", "--count", "HEAD"]).stdout.trim();
	return out === "" ? 0 : Number(out);
}

/** HEAD's subject line. */
export function headSubject(repo: string): string {
	return git(repo, ["log", "-1", "--format=%s"]).stdout.trim();
}

/** A paper document, accepted and ready to publish by default. */
export function paper(
	over: Partial<{ title: string; status: string; kind: string | undefined; body: string }> = {},
): DocSpec {
	const frontmatter: Record<string, unknown> = {
		title: over.title ?? "The Grift",
		date: "2026-09-09",
		status: over.status ?? "accepted",
		description: "A critique.",
	};
	const kind = "kind" in over ? over.kind : "paper";
	if (kind !== undefined) frontmatter.kind = kind;
	return { frontmatter, body: over.body ?? "# The Grift\n\nThere is real skill here.\n" };
}
