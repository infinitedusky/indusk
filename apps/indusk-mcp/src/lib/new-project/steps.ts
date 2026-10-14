/**
 * The steps of making a project (new-project-flow, ADR decision 5), named once
 * for the command that prints them, the route that streams them and the page
 * that draws them. Pure data - no Node imports - so a client component can read
 * it through the `./new-project/steps` subpath.
 *
 * promise: a-new-project-is-made-by-the-agent
 */

export type CreationStepId = "workbench" | "repository" | "install" | "documents" | "github";

/** Where one step stands. `waiting` is a step not yet reached. */
export type CreationStepState = "waiting" | "working" | "done" | "failed";

/** What a step is called while it runs or waits (`doing`) and once it is over (`done`). */
export const CREATION_STEPS: Record<CreationStepId, { doing: string; done: string }> = {
	workbench: { doing: "Creating the workbench", done: "Workbench created" },
	repository: { doing: "Creating the repository inside it", done: "Repository created inside it" },
	install: { doing: "Installing InDusk", done: "InDusk installed" },
	documents: {
		doing: "Writing the founding brief and master plan",
		done: "Founding brief and master plan written",
	},
	github: {
		doing: "Creating the private GitHub repository",
		done: "Private GitHub repository created",
	},
};

/** The steps a creation runs, in order; the GitHub one only when the proposal confirms the remote. */
export function creationStepIds(remote: boolean): CreationStepId[] {
	const ids: CreationStepId[] = ["workbench", "repository", "install", "documents"];
	return remote ? [...ids, "github"] : ids;
}

/** A step's words for the state it is in. */
export const stepLabel = (id: CreationStepId, state: CreationStepState): string =>
	state === "done" ? CREATION_STEPS[id].done : CREATION_STEPS[id].doing;

/**
 * The record of a creation that a draft keeps while it runs (`creating.json`):
 * every step and where it stands, and why it stopped when it did.
 */
export interface CreationRecord {
	steps: { id: CreationStepId; state: CreationStepState }[];
	error?: string;
}
