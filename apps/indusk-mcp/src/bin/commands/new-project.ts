import { readFileSync } from "node:fs";
import { basename } from "node:path";
import {
	addDocument,
	CreationError,
	createProject,
	createProjectDraft,
	type DraftDocument,
	discardProjectDraft,
	findProjectDraft,
	readParent,
	readTranscript,
	setParent,
	stepLabel,
} from "../../lib/new-project/index.js";
import { induskHome } from "../../lib/telemetry/status.js";

/**
 * `indusk new-project` (new-project-flow): the drafts of projects not yet made.
 * Each command works on `<INDUSK_HOME>/new-projects/` and nothing else - a
 * project is made only by `accept`, and a draft left alone creates nothing.
 *
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 */

function documentFrom(file: string): DraftDocument {
	return { name: basename(file), content: readFileSync(file) };
}

function fail(message: string): void {
	console.error(message);
	process.exitCode = 1;
}

/** `start`: open a conversation holding the first message and any documents; print its id. */
export function newProjectStart(opts: { message: string; document?: string[] }): void {
	let documents: DraftDocument[];
	try {
		documents = (opts.document ?? []).map(documentFrom);
	} catch (err) {
		fail(`Cannot read a document: ${(err as Error).message}`);
		return;
	}
	const draft = createProjectDraft(induskHome(), { message: opts.message, documents });
	console.info(draft.id);
}

/** `add`: put a document in a conversation; when its name was there, print what changed. */
export function newProjectAdd(id: string, file: string): void {
	const draft = findProjectDraft(induskHome(), id);
	if (!draft) {
		fail(`No project conversation ${id}.`);
		return;
	}
	let added: ReturnType<typeof addDocument>;
	try {
		added = addDocument(draft, documentFrom(file));
	} catch (err) {
		fail(`Cannot add ${file}: ${(err as Error).message}`);
		return;
	}
	if (!added.replaced) console.info(`Added ${added.name}.`);
	else if (added.diff === "") console.info(`${added.name} is unchanged.`);
	else console.info(`${added.name} changed; the newer is kept.\n${added.diff}`);
}

/** `discard`: remove a conversation and everything it held. */
export function newProjectDiscard(id: string): void {
	discardProjectDraft(induskHome(), id);
	console.info(`Discarded ${id}.`);
}

/** `transcript`: print what a conversation has said, one JSON line per event, as the admin reads it back. */
export function newProjectTranscript(id: string): void {
	const draft = findProjectDraft(induskHome(), id);
	if (!draft) {
		fail(`No project conversation ${id}.`);
		return;
	}
	for (const line of readTranscript(draft)) console.info(JSON.stringify(line));
}

/** `parent`: set the directory new projects are made in, or print it. */
export function newProjectParent(dir?: string): void {
	if (dir === undefined) {
		const parent = readParent();
		if (parent) console.info(parent);
		else fail("No parent directory is set. Set one with: indusk new-project parent <dir>");
		return;
	}
	console.info(`New projects will be made in ${setParent(dir)}.`);
}

/**
 * `accept`: make the project the proposal describes, printing each step as it
 * runs. A proposal that is refused (every problem named) or a parent that is
 * unset or does not hold the location stops before anything is made.
 *
 * promise: the-core-is-always-kept
 * promise: a-new-project-is-made-by-the-agent
 */
export async function newProjectAccept(id: string): Promise<void> {
	try {
		const created = await createProject(induskHome(), id, {
			report: (step, state) => {
				if (state === "working") console.info(`... ${stepLabel(step, state)}`);
				else if (state === "done") console.info(`ok  ${stepLabel(step, state)}`);
				else console.info(`FAILED  ${stepLabel(step, state)}`);
			},
		});
		console.info(`\nCreated ${created.name} at ${created.root}`);
		if (created.remoteError) {
			fail(`The project is made, but its GitHub repository was not: ${created.remoteError}`);
		}
	} catch (err) {
		if (!(err instanceof CreationError)) throw err;
		fail(err.message);
	}
}
