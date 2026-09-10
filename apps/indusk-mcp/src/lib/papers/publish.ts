import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import matter from "gray-matter";
import { getPlanningDir } from "../config.js";
import { git } from "../git.js";
import { paperContentHash } from "../plan-parser.js";
import { DestinationError, type ResolvedDestination, resolveDestination } from "./destination.js";
import { collectIndexEntries, IndexError, regenerateIndex } from "./index-page.js";
import { withProvenance } from "./provenance.js";
import { renderForDestination, type SiblingPaths, slugForTitle } from "./render.js";

/**
 * `indusk papers publish` — the plan copy is the source, the destination is
 * a build artifact, and every publish is traceable to a commit.
 *
 * Eight steps in order, each refusing loudly with nothing written when its
 * precondition does not hold: read and validate the paper; the source is
 * committed; the destination resolves, exists, and is a git repo; the target
 * page is not dirty; render; regenerate the index; commit in the destination
 * (never push without being asked); write provenance back and commit it in
 * the source, because without that commit the very next publish would refuse
 * on an uncommitted source.
 */

/** A refusal the command prints and exits 1 on. Nothing was written. */
export class PublishRefusal extends Error {}

export interface PublishOptions {
	projectRoot: string;
	plan: string;
	file: string;
	destination?: string;
	push?: boolean;
}

export interface PublishResult {
	kind: "published" | "up-to-date";
	destination: string;
	/** Destination-root-relative page path. */
	page: string;
	destinationCommit?: string;
	sourceCommit?: string;
	/** The page had been committed to by hand since the last publish and was overwritten. */
	diverged?: boolean;
	warnings: string[];
}

async function isGitRepo(dir: string): Promise<boolean> {
	try {
		return (await git(dir, "rev-parse", "--is-inside-work-tree")) === "true";
	} catch {
		return false;
	}
}

/** Short shas of possibly different lengths name the same commit when one prefixes the other. */
function sameCommit(a: string, b: string): boolean {
	return a !== "" && b !== "" && (a.startsWith(b) || b.startsWith(a));
}

/** Every sibling document → its published path, for link rewriting. */
function siblingPaths(planDir: string): SiblingPaths {
	const map: SiblingPaths = new Map();
	for (const file of readdirSync(planDir)) {
		if (!file.endsWith(".md")) continue;
		try {
			const { data } = matter(readFileSync(join(planDir, file), "utf-8"));
			const published = data.published as { path?: unknown } | undefined;
			map.set(file, typeof published?.path === "string" ? published.path : null);
		} catch {
			map.set(file, null);
		}
	}
	return map;
}

export async function publishPaper(opts: PublishOptions): Promise<PublishResult> {
	const { projectRoot, plan, file } = opts;

	// 1. The paper.
	const planDir = join(getPlanningDir(projectRoot), plan);
	const paperPath = join(planDir, file);
	if (!existsSync(paperPath)) throw new PublishRefusal(`No such paper: ${plan}/${file}`);
	const raw = readFileSync(paperPath, "utf-8");
	const { data } = matter(raw);
	if (data.kind !== "paper") {
		throw new PublishRefusal(`${plan}/${file} does not declare kind: paper, so it is not a paper.`);
	}
	if (data.status !== "accepted" && data.status !== "published") {
		throw new PublishRefusal(
			`${plan}/${file} is ${typeof data.status === "string" ? data.status : "unstatused"}; a paper publishes once it is accepted.`,
		);
	}

	// 2. The source is committed.
	if (!(await isGitRepo(projectRoot))) {
		throw new PublishRefusal(
			`${projectRoot} is not a git repository; the plan copy must be committed before it publishes.`,
		);
	}
	const relPaper = relative(projectRoot, paperPath);
	if ((await git(projectRoot, "status", "--porcelain", "--", relPaper)) !== "") {
		throw new PublishRefusal(
			`${plan}/${file} has uncommitted changes; commit the plan copy first. A hotfix is a commit, then a publish.`,
		);
	}

	// 3. The destination.
	let dest: ResolvedDestination;
	try {
		dest = resolveDestination(projectRoot, opts.destination);
	} catch (err) {
		if (err instanceof DestinationError) throw new PublishRefusal(err.message);
		throw err;
	}
	if (!existsSync(dest.root)) {
		throw new PublishRefusal(`Destination "${dest.name}" path does not exist: ${dest.root}`);
	}
	if (!(await isGitRepo(dest.root))) {
		throw new PublishRefusal(`Destination "${dest.name}" is not a git repository: ${dest.root}`);
	}

	// 4. The target page is not dirty.
	const title = typeof data.title === "string" ? data.title : file.replace(/\.md$/, "");
	const pageRel = `${dest.dir}/${slugForTitle(title)}.md`;
	const pagePath = join(dest.root, pageRel);
	if ((await git(dest.root, "status", "--porcelain", "--", pageRel)) !== "") {
		throw new PublishRefusal(
			`Destination page ${pageRel} has uncommitted changes in ${dest.root}. Nobody hand-edits the destination: carry the change into the plan copy or discard it, then publish.`,
		);
	}

	// 5. Render, and stop here when nothing would change.
	const rendered = renderForDestination(raw, dest, siblingPaths(planDir));
	const hash = paperContentHash(raw);
	const existing = existsSync(pagePath) ? readFileSync(pagePath, "utf-8") : null;
	const recorded = data.published as { commit?: unknown; hash?: unknown } | undefined;
	if (existing !== null && existing === rendered.text && recorded?.hash === hash) {
		return {
			kind: "up-to-date",
			destination: dest.name,
			page: pageRel,
			warnings: rendered.warnings,
		};
	}
	let diverged = false;
	if (existing !== null) {
		const lastCommit = await git(dest.root, "log", "-1", "--format=%h", "--", pageRel);
		const recordedCommit = typeof recorded?.commit === "string" ? recorded.commit : "";
		diverged = !sameCommit(lastCommit, recordedCommit);
	}

	// 6. Write the page and regenerate the index; an index refusal undoes the page.
	mkdirSync(dirname(pagePath), { recursive: true });
	writeFileSync(pagePath, rendered.text);
	try {
		regenerateIndex(
			join(dest.root, dest.index),
			await collectIndexEntries(dest.root, dest.dir, dest.index),
		);
	} catch (err) {
		if (existing === null) rmSync(pagePath, { force: true });
		else writeFileSync(pagePath, existing);
		if (err instanceof IndexError) throw new PublishRefusal(err.message);
		throw err;
	}

	// 7. Commit in the destination. Push only when asked.
	const sourceCommit = (await git(projectRoot, "log", "-1", "--format=%H", "--", relPaper)).slice(
		0,
		8,
	);
	const message = diverged
		? `publish: ${title} (source ${sourceCommit})\n\nDestination page had diverged from the last publish (committed to in place at ${dest.root}); overwritten from the plan copy.`
		: `publish: ${title} (source ${sourceCommit})`;
	await git(dest.root, "add", "--", pageRel, dest.index);
	await git(dest.root, "commit", "-q", "-m", message);
	const destinationCommit = await git(dest.root, "rev-parse", "--short", "HEAD");
	if (opts.push) await git(dest.root, "push");

	// 8. Provenance back into the paper, committed in the source.
	writeFileSync(
		paperPath,
		withProvenance(raw, {
			destination: dest.name,
			path: pageRel,
			commit: destinationCommit,
			source_commit: sourceCommit,
			hash,
		}),
	);
	await git(projectRoot, "add", "--", relPaper);
	await git(
		projectRoot,
		"commit",
		"-q",
		"-m",
		`chore(papers): publish ${file} to ${dest.name} (${destinationCommit})`,
	);

	return {
		kind: "published",
		destination: dest.name,
		page: pageRel,
		destinationCommit,
		sourceCommit,
		diverged,
		warnings: rendered.warnings,
	};
}
