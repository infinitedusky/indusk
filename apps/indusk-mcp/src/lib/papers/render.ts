import matter from "gray-matter";
import type { ResolvedDestination } from "./destination.js";

/**
 * A paper's page as the destination sees it.
 *
 * The body travels verbatim. Frontmatter travels only through the
 * destination's key map (default: title and description), so `kind`,
 * `status`, `published`, and `date` never leak into the site. Relative links
 * to sibling plan documents are rewritten to their published paths when the
 * sibling is published, and left alone with a warning when it is not.
 */

/** The destination filename for a title: kebab-case ASCII, never empty. */
export function slugForTitle(title: string): string {
	const slug = title
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug === "" ? "paper" : slug;
}

/** Sibling documents by filename → their published path, or null when unpublished. */
export type SiblingPaths = Map<string, string | null>;

export interface RenderedPage {
	frontmatter: Record<string, unknown>;
	/** The full page text: mapped frontmatter plus the verbatim body. */
	text: string;
	warnings: string[];
}

export function renderForDestination(
	raw: string,
	dest: ResolvedDestination,
	siblings: SiblingPaths,
): RenderedPage {
	const { data, content } = matter(raw);
	const frontmatter: Record<string, unknown> = {};
	for (const [from, to] of Object.entries(dest.frontmatter)) {
		if (data[from] !== undefined) frontmatter[to] = data[from];
	}

	const warnings: string[] = [];
	const body = content.replace(
		/\]\(([^)\s]+\.md)(#[^)]*)?\)/g,
		(whole: string, target: string, anchor: string | undefined) => {
			const file = target.replace(/^\.\//, "");
			if (!siblings.has(file)) return whole;
			const published = siblings.get(file);
			if (published === null || published === undefined) {
				warnings.push(`link to ${file} left as is: that document is not published`);
				return whole;
			}
			return `](/${published.replace(/\.md$/, "")}${anchor ?? ""})`;
		},
	);

	return { frontmatter, text: matter.stringify(body, frontmatter), warnings };
}
