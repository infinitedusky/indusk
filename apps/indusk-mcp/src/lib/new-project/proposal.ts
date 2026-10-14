import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isUsableSegment } from "../path-segment.js";
import { coreDocumentIn, DOCUMENT_LABELS } from "../workflow-types.js";
import type { Visibility } from "./github.js";
import type { ProjectDraft } from "./store.js";

/**
 * A project draft's proposal (new-project-flow, ADR decision 3): the name,
 * location and shape the agent proposes, written to `proposal.json` in the
 * draft's folder once the conversation settles them. It is read and checked
 * here, once, for the page that shows it and the command that accepts it, so
 * neither restates what a valid proposal is.
 *
 * What is checked is shape and the core: a name that is a clean kebab-case
 * segment, an absolute location, at least one repository, a reason beside every
 * declined recommendation, and no turn-off of the brief or the test plan.
 * Whether the location is under the configured parent is creation's guard, not
 * the proposal's.
 *
 * promise: the-core-is-always-kept
 */

export interface ProposalRecommendation {
	name: string;
	kept: boolean;
	/** The person's words; required when the recommendation is declined. */
	reason?: string;
	/** The practice in a few words, as the proposal's page reads it; the name when absent. */
	title?: string;
	/** One line on why it is recommended. */
	why?: string;
}

export interface Proposal {
	name: string;
	location: string;
	repos: { name: string }[];
	milestones: string[];
	recommendations: ProposalRecommendation[];
	/** Planning documents the project does not write; never the brief or the test plan. */
	documentsOff: string[];
	/** `visibility` is private unless the person chose public. */
	remote: { github: boolean; visibility: Visibility };
}

/** What a proposal is, or why it is not one: every problem found, none repaired. */
export interface ProposalCheck {
	proposal: Proposal | null;
	problems: string[];
}

/** A proposal that cannot be accepted; the message names every problem. */
export class ProposalError extends Error {
	constructor(readonly problems: string[]) {
		super(problems.join("; "));
		this.name = "ProposalError";
	}
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
	typeof value === "string" && value.trim() !== "";

/** The documents a project may turn off: every planning document but the core. */
const KNOWN_DOCUMENTS = Object.keys(DOCUMENT_LABELS);

/**
 * Check a parsed `proposal.json`. Collects every problem rather than stopping
 * at the first, so the person sees all of them at once.
 */
export function validateProposal(raw: unknown): ProposalCheck {
	if (!isObject(raw)) return { proposal: null, problems: ["the proposal is not an object"] };
	const problems: string[] = [];

	const name = raw.name;
	if (!isText(name) || !KEBAB.test(name) || !isUsableSegment(name)) {
		problems.push("name must be lower-case words joined by hyphens, like homework-gate");
	}

	const location = raw.location;
	if (!isText(location) || !isAbsolute(location)) {
		problems.push("location must be an absolute directory");
	}

	const repos = Array.isArray(raw.repos) ? raw.repos : [];
	const repoNames = repos.map((r) => (isObject(r) ? r.name : undefined));
	if (repos.length === 0) problems.push("repos must name at least one repository");
	for (const repo of repoNames) {
		if (!isText(repo) || !isUsableSegment(repo)) {
			problems.push(`repository ${JSON.stringify(repo)} is not a usable folder name`);
		}
	}
	if (repoNames.includes("worktrees")) {
		problems.push("a repository cannot be named worktrees: that folder is where plan worktrees go");
	}
	if (new Set(repoNames).size !== repoNames.length) problems.push("repos names a repository twice");

	const milestones = Array.isArray(raw.milestones) ? raw.milestones : [];
	if (!Array.isArray(raw.milestones) || !milestones.every(isText)) {
		problems.push("milestones must be a list of names");
	}

	const recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : [];
	if (!Array.isArray(raw.recommendations)) problems.push("recommendations must be a list");
	for (const rec of recommendations) {
		if (!isObject(rec) || !isText(rec.name) || typeof rec.kept !== "boolean") {
			problems.push("a recommendation needs a name and kept: true or false");
		} else if (!rec.kept && !isText(rec.reason)) {
			problems.push(`declining ${rec.name} needs the person's reason`);
		} else if (
			(rec.title !== undefined && !isText(rec.title)) ||
			(rec.why !== undefined && !isText(rec.why))
		) {
			problems.push(`${rec.name}: title and why, when given, must be text`);
		}
	}

	const documentsOff = Array.isArray(raw.documentsOff) ? raw.documentsOff : [];
	if (!Array.isArray(raw.documentsOff) || !documentsOff.every(isText)) {
		problems.push("documentsOff must be a list of document names");
	} else {
		const core = coreDocumentIn(documentsOff);
		if (core !== null) {
			problems.push(
				`${core} cannot be turned off: a plan always keeps its brief and its test plan`,
			);
		}
		for (const doc of documentsOff) {
			if (!KNOWN_DOCUMENTS.includes(doc)) {
				problems.push(`${doc} is not a planning document`);
			}
		}
	}

	if (!isObject(raw.remote) || typeof raw.remote.github !== "boolean") {
		problems.push("remote must say github: true or false");
	} else if (
		raw.remote.visibility !== undefined &&
		raw.remote.visibility !== "private" &&
		raw.remote.visibility !== "public"
	) {
		problems.push("remote visibility must be private or public");
	}

	if (problems.length > 0) return { proposal: null, problems };
	return {
		proposal: {
			name: name as string,
			location: location as string,
			repos: repoNames.map((repo) => ({ name: repo as string })),
			milestones: milestones as string[],
			recommendations: (recommendations as ProposalRecommendation[]).map((rec) => ({
				name: rec.name,
				kept: rec.kept,
				...(rec.title ? { title: rec.title } : {}),
				...(rec.why ? { why: rec.why } : {}),
				...(rec.kept ? {} : { reason: rec.reason }),
			})),
			documentsOff: documentsOff as string[],
			remote: {
				github: (raw.remote as { github: boolean }).github,
				visibility: (raw.remote as { visibility?: Visibility }).visibility ?? "private",
			},
		},
		problems: [],
	};
}

const proposalPath = (draft: ProjectDraft): string => join(draft.dir, "proposal.json");

/** The draft's proposal, checked; no proposal yet and unreadable JSON are problems like any other. */
export function loadProposal(draft: ProjectDraft): ProposalCheck {
	if (!existsSync(proposalPath(draft))) {
		return { proposal: null, problems: ["the agent has not written a proposal yet"] };
	}
	try {
		return validateProposal(JSON.parse(readFileSync(proposalPath(draft), "utf-8")));
	} catch (err) {
		return {
			proposal: null,
			problems: [`proposal.json is not readable: ${(err as Error).message}`],
		};
	}
}

/** The draft's proposal, or a ProposalError naming every problem. */
export function readProposal(draft: ProjectDraft): Proposal {
	const { proposal, problems } = loadProposal(draft);
	if (proposal === null) throw new ProposalError(problems);
	return proposal;
}

/**
 * Keep the person's edits: the proposal as they changed it, written back to
 * the draft after the same check. An edit that is not a proposal is refused
 * and nothing is written.
 */
export function saveProposal(draft: ProjectDraft, edited: unknown): Proposal {
	const { proposal, problems } = validateProposal(edited);
	if (proposal === null) throw new ProposalError(problems);
	writeFileSync(proposalPath(draft), `${JSON.stringify(proposal, null, 2)}\n`);
	return proposal;
}
