import {
	type Dirent,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
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
 * Ten steps in order. The first five refuse loudly with nothing written when
 * a precondition does not hold: read and validate the paper; the source is
 * committed; the destination resolves, exists, and is a git repo; the target
 * page is this paper's and nothing there is dirty; render, and stop when
 * nothing would change. Steps six and seven write and commit in the
 * destination, and any failure between them restores the destination to what
 * it was. Step eight writes provenance back and commits it in the source,
 * because without that commit the very next publish would refuse on an
 * uncommitted source. Step nine pushes only when asked, and last, because the
 * publish is complete without it. Step ten reports the published siblings
 * this publish left behind.
 */

/** A refusal the command prints and exits 1 on. Says what state it left. */
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
	/** Set when `--push` was asked for and failed. The publish itself completed. */
	pushError?: string;
	warnings: string[];
}

/** The `published` block as read from frontmatter, before any narrowing. */
interface Recorded {
	destination?: unknown;
	path?: unknown;
	commit?: unknown;
	hash?: unknown;
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

/**
 * The divergence rule, in one place: an existing destination page has
 * diverged when its last destination commit is not the one the paper
 * recorded at the previous publish, or when nothing was recorded at all (a
 * hand-copied page the publish is taking over). A diverged page is
 * overwritten — the destination is a build artifact — and the commit body
 * says so. Uncommitted edits never reach here; step 4 refuses them.
 */
export async function pageDiverged(
	destRoot: string,
	pageRel: string,
	recordedCommit: string | null,
): Promise<boolean> {
	const lastCommit = await git(destRoot, "log", "-1", "--format=%h", "--", pageRel);
	return recordedCommit === null || !sameCommit(lastCommit, recordedCommit);
}

/** git's own words for a failure, without the "Command failed: git …" preface the runner adds. */
function gitMessage(err: unknown): string {
	const message = err instanceof Error ? err.message : String(err);
	const stripped = message.replace(/^Command failed: git [^\n]*\n?/, "").trim();
	return stripped === "" ? message : stripped;
}

/** Every sibling document → its published path, for link rewriting. */
function siblingPaths(planDir: string): SiblingPaths {
	const map: SiblingPaths = new Map();
	for (const file of readdirSync(planDir)) {
		if (!file.endsWith(".md")) continue;
		try {
			const { data } = matter(readFileSync(join(planDir, file), "utf-8"));
			const published = data.published as Recorded | undefined;
			map.set(file, typeof published?.path === "string" ? published.path : null);
		} catch {
			map.set(file, null);
		}
	}
	return map;
}

/**
 * The first *other* plan document, anywhere under the planning directory
 * (active and archive), that records a publish to `pageRel` at `destName`;
 * as a planning-relative path, or null. Two titles can slug identically, and
 * a title with no ASCII in it slugs to `paper`; without this the second
 * publish would read the first's page as diverged and overwrite it.
 */
function otherPaperPublishedAt(
	planningDir: string,
	destName: string,
	pageRel: string,
	selfPath: string,
): string | null {
	const stack = [planningDir];
	while (stack.length > 0) {
		const dir = stack.pop() as string;
		let entries: Dirent[];
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch {
			continue;
		}
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				stack.push(full);
				continue;
			}
			if (!entry.name.endsWith(".md") || full === selfPath) continue;
			let published: Recorded | undefined;
			try {
				published = matter(readFileSync(full, "utf-8")).data.published as Recorded | undefined;
			} catch {
				continue;
			}
			if (published?.destination === destName && published?.path === pageRel) {
				return relative(planningDir, full);
			}
		}
	}
	return null;
}

/** Each path's content before this publish touched it; null when it did not exist. */
type Snapshot = Map<string, string | null>;

function snapshot(root: string, rels: string[]): Snapshot {
	const taken: Snapshot = new Map();
	for (const rel of rels) {
		const path = join(root, rel);
		taken.set(rel, existsSync(path) ? readFileSync(path, "utf-8") : null);
	}
	return taken;
}

/** Put the destination back: unstage, then restore or remove each path. */
async function restore(root: string, taken: Snapshot): Promise<void> {
	try {
		await git(root, "reset", "-q", "--", ...taken.keys());
	} catch {
		// Nothing was staged, or a path was never tracked. The rewrite below is what matters.
	}
	for (const [rel, previous] of taken) {
		const path = join(root, rel);
		if (previous === null) {
			rmSync(path, { force: true });
		} else {
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, previous);
		}
	}
}

/**
 * Published siblings whose page would render differently now — because this
 * publish gave them a target their links can point at. Link rewriting only
 * sees siblings published before the paper being published, and staleness
 * cannot see this at all, because the sibling's own content did not change.
 */
function behindSiblings(
	planDir: string,
	plan: string,
	file: string,
	dest: ResolvedDestination,
): string[] {
	const siblings = siblingPaths(planDir);
	const behind: string[] = [];
	for (const [sibling, path] of siblings) {
		if (sibling === file || path === null) continue;
		const raw = readFileSync(join(planDir, sibling), "utf-8");
		let recorded: Recorded | undefined;
		try {
			recorded = matter(raw).data.published as Recorded | undefined;
		} catch {
			continue;
		}
		if (recorded?.destination !== dest.name) continue;
		const pagePath = join(dest.root, path);
		if (!existsSync(pagePath)) continue;
		if (renderForDestination(raw, dest, siblings).text !== readFileSync(pagePath, "utf-8")) {
			behind.push(
				`${sibling} links to this paper and is now behind; run: indusk papers publish ${plan}/${sibling}`,
			);
		}
	}
	return behind;
}

export async function publishPaper(opts: PublishOptions): Promise<PublishResult> {
	const { projectRoot, plan, file } = opts;
	const planningDir = getPlanningDir(projectRoot);

	// 1. The paper.
	const planDir = join(planningDir, plan);
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
	const recorded = data.published as Recorded | undefined;
	const recordedCommit = typeof recorded?.commit === "string" ? recorded.commit : null;
	const recordedPath = typeof recorded?.path === "string" ? recorded.path : null;

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

	// 4. The target page: its name, that no other paper owns it, and that nothing there is dirty.
	const title = typeof data.title === "string" ? data.title : file.replace(/\.md$/, "");
	const pageRel = `${dest.dir}/${slugForTitle(title)}.md`;
	const pagePath = join(dest.root, pageRel);
	const owner = otherPaperPublishedAt(planningDir, dest.name, pageRel, paperPath);
	if (owner !== null) {
		throw new PublishRefusal(
			`Destination page ${pageRel} is already published from ${owner}; two papers cannot share a title slug. Retitle one of them.`,
		);
	}
	// A retitled paper's page still sits where the last publish recorded it.
	const oldRel =
		recordedPath !== null &&
		recordedPath !== pageRel &&
		recorded?.destination === dest.name &&
		existsSync(join(dest.root, recordedPath))
			? recordedPath
			: null;
	for (const rel of oldRel === null ? [pageRel] : [pageRel, oldRel]) {
		if ((await git(dest.root, "status", "--porcelain", "--", rel)) !== "") {
			throw new PublishRefusal(
				`Destination page ${rel} has uncommitted changes in ${dest.root}. Nobody hand-edits the destination: carry the change into the plan copy or discard it, then publish.`,
			);
		}
	}

	// 5. Render, and stop here when nothing would change. "Nothing" includes the
	// paper's own status: an accepted paper with a matching page is republished
	// so that provenance and status are written, not reported up to date.
	const rendered = renderForDestination(raw, dest, siblingPaths(planDir));
	const hash = paperContentHash(raw);
	const existing = existsSync(pagePath) ? readFileSync(pagePath, "utf-8") : null;
	const upToDate =
		data.status === "published" &&
		oldRel === null &&
		existing !== null &&
		existing === rendered.text &&
		recorded?.hash === hash;
	if (upToDate) {
		return {
			kind: "up-to-date",
			destination: dest.name,
			page: pageRel,
			warnings: rendered.warnings,
		};
	}
	const replacingRel = oldRel ?? pageRel;
	const diverged =
		existsSync(join(dest.root, replacingRel)) &&
		(await pageDiverged(dest.root, replacingRel, recordedCommit));

	// 6. Write the page (moving a retitled one) and regenerate the index. From
	// here to the destination commit, any failure restores the destination.
	const touched = oldRel === null ? [pageRel, dest.index] : [pageRel, dest.index, oldRel];
	const before = snapshot(dest.root, touched);
	try {
		if (oldRel !== null) await git(dest.root, "mv", "--", oldRel, pageRel);
		mkdirSync(dirname(pagePath), { recursive: true });
		writeFileSync(pagePath, rendered.text);
		regenerateIndex(
			join(dest.root, dest.index),
			await collectIndexEntries(dest.root, dest.dir, dest.index),
		);
	} catch (err) {
		await restore(dest.root, before);
		if (err instanceof IndexError) throw new PublishRefusal(err.message);
		throw new PublishRefusal(`Could not write the destination page: ${gitMessage(err)}`);
	}

	// 7. Commit in the destination. A page and index byte-identical to HEAD
	// have nothing to commit; the page's last commit stands as the record.
	const sourceCommit = (await git(projectRoot, "log", "-1", "--format=%H", "--", relPaper)).slice(
		0,
		8,
	);
	let destinationCommit: string;
	try {
		await git(dest.root, "add", "--", ...touched.filter((rel) => existsSync(join(dest.root, rel))));
		const staged = await git(dest.root, "status", "--porcelain", "--", ...touched);
		if (staged === "") {
			const last = await git(dest.root, "log", "-1", "--format=%h", "--", pageRel);
			destinationCommit = last === "" ? await git(dest.root, "rev-parse", "--short", "HEAD") : last;
		} else {
			const message = diverged
				? `publish: ${title} (source ${sourceCommit})\n\nDestination page had diverged from the last publish (committed to in place at ${dest.root}); overwritten from the plan copy.`
				: `publish: ${title} (source ${sourceCommit})`;
			await git(dest.root, "commit", "-q", "-m", message);
			destinationCommit = await git(dest.root, "rev-parse", "--short", "HEAD");
		}
	} catch (err) {
		await restore(dest.root, before);
		throw new PublishRefusal(
			`Destination commit failed in ${dest.root}; the destination was restored and nothing was published. git said: ${gitMessage(err)}`,
		);
	}

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
	try {
		await git(projectRoot, "add", "--", relPaper);
		await git(
			projectRoot,
			"commit",
			"-q",
			"-m",
			`chore(papers): publish ${file} to ${dest.name} (${destinationCommit})`,
		);
	} catch (err) {
		throw new PublishRefusal(
			`Published to ${dest.name} as ${destinationCommit}, but the source commit failed; the provenance is written to ${relPaper} and needs a hand commit. git said: ${gitMessage(err)}`,
		);
	}

	// 9. Push only when asked, and last: the publish is complete without it.
	let pushError: string | undefined;
	if (opts.push) {
		try {
			await git(dest.root, "push");
		} catch (err) {
			pushError = gitMessage(err);
		}
	}

	// 10. The published siblings this publish left behind.
	const warnings = [...rendered.warnings, ...behindSiblings(planDir, plan, file, dest)];

	return {
		kind: "published",
		destination: dest.name,
		page: pageRel,
		destinationCommit,
		sourceCommit,
		diverged,
		...(pushError !== undefined && { pushError }),
		warnings,
	};
}
