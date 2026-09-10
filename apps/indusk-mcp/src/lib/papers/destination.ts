import { homedir } from "node:os";
import { resolve } from "node:path";
import { type PaperDestination, readConfig } from "../config.js";
import { isWorkbench, readWorkbenchRepos, repoDir, resolveReposRoot } from "../worktree/repos.js";

/** A refusal the publish step prints and exits on. Never partially applied. */
export class DestinationError extends Error {}

export interface ResolvedDestination {
	name: string;
	/** Absolute path of the destination root. Existence is the publish step's check. */
	root: string;
	dir: string;
	index: string;
	frontmatter: Record<string, string>;
}

const DEFAULT_FRONTMATTER: Record<string, string> = { title: "title", description: "description" };

/**
 * Which destination, and where it is. Pure: reads config and declarations,
 * touches nothing on disk. A `path` expands `~` and resolves relative to the
 * project root; a `repo` is a declared workbench repo and is refused outside a
 * workbench, because a project that is not one has no declarations to read.
 */
export function resolveDestination(projectRoot: string, name?: string): ResolvedDestination {
	const destinations = readConfig(projectRoot)?.papers?.destinations ?? [];
	if (destinations.length === 0) {
		throw new DestinationError(
			"No paper destinations configured — add one under papers.destinations in .indusk/config.json (name, path or repo, dir, index).",
		);
	}
	const names = destinations.map((d) => d.name).join(", ");
	let chosen: PaperDestination | undefined;
	if (name === undefined) {
		if (destinations.length > 1) {
			throw new DestinationError(
				`More than one destination is configured (${names}) — pass --to <name>.`,
			);
		}
		chosen = destinations[0];
	} else {
		chosen = destinations.find((d) => d.name === name);
		if (!chosen)
			throw new DestinationError(`No destination named "${name}"; configured: ${names}.`);
	}

	return {
		name: chosen.name,
		root: destinationRoot(projectRoot, chosen),
		dir: chosen.dir,
		index: chosen.index,
		frontmatter: chosen.frontmatter ?? DEFAULT_FRONTMATTER,
	};
}

function destinationRoot(projectRoot: string, dest: PaperDestination): string {
	if (dest.repo !== undefined) {
		if (!isWorkbench(projectRoot)) {
			throw new DestinationError(
				`Destination "${dest.name}" names a repo ("${dest.repo}"), but this project is not a workbench — only paths are accepted here.`,
			);
		}
		const repos = readWorkbenchRepos(projectRoot);
		const repo = repos.find((r) => r.name === dest.repo);
		if (!repo) {
			throw new DestinationError(
				`Destination "${dest.name}" names repo "${dest.repo}", which worktree.repos[] does not declare (declared: ${repos.map((r) => r.name).join(", ") || "none"}).`,
			);
		}
		return resolve(resolveReposRoot(projectRoot), repoDir(repo));
	}
	if (dest.path === undefined || dest.path === "") {
		throw new DestinationError(`Destination "${dest.name}" has neither path nor repo.`);
	}
	const expanded = dest.path.startsWith("~/") ? resolve(homedir(), dest.path.slice(2)) : dest.path;
	return resolve(projectRoot, expanded);
}
