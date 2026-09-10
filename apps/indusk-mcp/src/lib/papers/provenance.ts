/**
 * The provenance a publish writes back into the paper's frontmatter.
 *
 * A text edit, deliberately not a gray-matter round trip: the round trip
 * re-dumps every key, and js-yaml turns an unquoted `date: 2026-09-09` into
 * an ISO timestamp and strips quotes it considers unnecessary. Every publish
 * would then rewrite lines it has no business touching. This replaces only
 * the `status` line and the `published` block, and leaves every other byte
 * of the frontmatter where it was.
 */

export interface Provenance {
	destination: string;
	/** Destination-root-relative page path. */
	path: string;
	/** Destination commit, short. */
	commit: string;
	/** Source commit the plan copy was published from, short. */
	source_commit: string;
	/** `paperContentHash` of the plan copy at publish time. */
	hash: string;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;

export function withProvenance(raw: string, prov: Provenance): string {
	const match = FENCE.exec(raw);
	if (!match) throw new Error("paper has no frontmatter fence to write provenance into");

	const kept: string[] = [];
	let inPublishedBlock = false;
	for (const line of match[1].split(/\r?\n/)) {
		if (/^status:/.test(line)) {
			inPublishedBlock = false;
			continue;
		}
		if (/^published:/.test(line)) {
			inPublishedBlock = true;
			continue;
		}
		if (inPublishedBlock && /^[ \t]/.test(line)) continue;
		inPublishedBlock = false;
		kept.push(line);
	}
	// Commits are quoted: an all-digit short sha would otherwise read as a number.
	kept.push(
		"status: published",
		"published:",
		`  destination: ${prov.destination}`,
		`  path: ${prov.path}`,
		`  commit: "${prov.commit}"`,
		`  source_commit: "${prov.source_commit}"`,
		`  hash: ${prov.hash}`,
	);
	return `---\n${kept.join("\n")}\n---\n${raw.slice(match[0].length)}`;
}
