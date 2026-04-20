import { ProjectCard, type ProjectCardData } from "./ProjectCard";

export interface ProjectGridProps {
	projects: ProjectCardData[];
}

/**
 * Homepage project grid. Shows one `<ProjectCard>` per registered project.
 * Empty state when the registry is empty — the user hasn't run `indusk init`
 * on any project yet, and the message has to point them at the right CLI.
 */
export function ProjectGrid({ projects }: ProjectGridProps) {
	if (projects.length === 0) {
		return (
			<div
				className="flex h-full flex-col items-center justify-center text-center text-gray-500"
				data-testid="project-grid-empty"
			>
				<h1 className="text-lg font-semibold text-gray-700">
					No projects registered yet
				</h1>
				<p className="mt-2 max-w-md text-sm">
					Run{" "}
					<code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
						indusk init
					</code>{" "}
					inside a project to register it. Already-registered projects move to
					the front via{" "}
					<code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
						indusk update
					</code>
					.
				</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-5xl p-2">
			<div className="mb-4 flex items-end justify-between">
				<div>
					<h1 className="text-xl font-semibold text-gray-900">Projects</h1>
					<p className="text-sm text-gray-500">
						Every project registered in{" "}
						<code className="font-mono text-xs">~/.indusk/projects.json</code>.
					</p>
				</div>
			</div>
			<div
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
				data-testid="project-grid"
			>
				{projects.map((p) => (
					<ProjectCard key={p.name} project={p} />
				))}
			</div>
		</div>
	);
}
