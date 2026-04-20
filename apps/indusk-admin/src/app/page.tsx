import type { ProjectCardData } from "@/components/ProjectCard";
import { ProjectGrid } from "@/components/ProjectGrid";
import { readActivePlans } from "@/lib/planning-reader";
import { readRegistryProjects } from "@/lib/registry-client";

/**
 * Homepage — the project grid. Walks every registered project in
 * `~/.indusk/projects.json`, reads each one's active plans (cheap; a
 * filesystem walk + frontmatter parse), and renders one card per project.
 *
 * The per-project `readActivePlans` call is awaited in parallel so adding
 * more projects scales linearly-ish with I/O parallelism rather than
 * serially. For projects whose path is deleted from disk the read returns
 * an empty list — the card still renders, just with `0 active plans`.
 * Phase 4 adds an explicit stale-project branch inside `/p/{name}/`.
 */
export default async function Home() {
	const registered = readRegistryProjects();

	const projects: ProjectCardData[] = await Promise.all(
		registered.map(async (entry) => {
			const active = await readActivePlans(entry.path).catch(() => []);
			return {
				name: entry.name,
				path: entry.path,
				lastSeenAt: entry.lastSeenAt,
				activePlanCount: active.length,
				hasInProgress: active.some((p) => p.status === "in-progress"),
			};
		}),
	);

	return <ProjectGrid projects={projects} />;
}
