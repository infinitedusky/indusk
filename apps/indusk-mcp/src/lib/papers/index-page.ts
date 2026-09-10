import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { git } from "../git.js";

/**
 * The destination's index page — the one thing on the site the publish step
 * owns outright. Everything between the marker pair is regenerated on every
 * publish from the pages present; nothing outside it is touched. This is why
 * the destination's VitePress config is never edited: the nav needs one
 * static link to this page, and the page is data the step controls.
 */

export const INDEX_MARKERS = ["<!-- papers:start -->", "<!-- papers:end -->"] as const;

/** A refusal about the index page: missing, or missing its markers. */
export class IndexError extends Error {}

export interface IndexEntry {
	title: string;
	/** Site-root-relative href, without the `.md`. */
	href: string;
	description?: string;
	/** Seconds since the epoch of the page's last destination commit; now for an uncommitted page. */
	at: number;
}

/** Every page in `dir` except the index itself, dated by its last destination commit. */
export async function collectIndexEntries(
	root: string,
	dir: string,
	indexRel: string,
): Promise<IndexEntry[]> {
	const folder = join(root, dir);
	if (!existsSync(folder)) return [];
	const entries: IndexEntry[] = [];
	for (const file of readdirSync(folder).sort()) {
		if (!file.endsWith(".md")) continue;
		const rel = `${dir}/${file}`;
		if (rel === indexRel) continue;
		const { data } = matter(readFileSync(join(folder, file), "utf-8"));
		const stem = file.replace(/\.md$/, "");
		entries.push({
			title: typeof data.title === "string" ? data.title : stem,
			href: `/${dir}/${stem}`,
			description: typeof data.description === "string" ? data.description : undefined,
			at: await lastCommitSeconds(root, rel),
		});
	}
	return entries;
}

async function lastCommitSeconds(root: string, rel: string): Promise<number> {
	try {
		const out = await git(root, "log", "-1", "--format=%ct", "--", rel);
		return out === "" ? Math.floor(Date.now() / 1000) : Number(out);
	} catch {
		return Math.floor(Date.now() / 1000);
	}
}

/**
 * Rewrite the block between the markers, newest first. Refuses, naming the
 * marker pair to add, when the page or its markers are absent — it never
 * appends to an index it cannot locate the block in.
 */
export function regenerateIndex(indexPath: string, entries: IndexEntry[]): void {
	const pair = `${INDEX_MARKERS[0]}\n${INDEX_MARKERS[1]}`;
	if (!existsSync(indexPath)) {
		throw new IndexError(
			`Index page ${indexPath} does not exist. Create it carrying the marker pair:\n${pair}`,
		);
	}
	const text = readFileSync(indexPath, "utf-8");
	const start = text.indexOf(INDEX_MARKERS[0]);
	const end = text.indexOf(INDEX_MARKERS[1]);
	if (start === -1 || end === -1 || end < start) {
		throw new IndexError(
			`Index page ${indexPath} has no marker pair. Add these two lines where the list should go; the block between them is regenerated on every publish:\n${pair}`,
		);
	}
	const block = [...entries]
		.sort((a, b) => b.at - a.at)
		.map((e) =>
			e.description ? `- [${e.title}](${e.href}): ${e.description}` : `- [${e.title}](${e.href})`,
		)
		.join("\n");
	const before = text.slice(0, start + INDEX_MARKERS[0].length);
	const after = text.slice(end);
	writeFileSync(indexPath, `${before}\n${block}\n${after}`);
}
