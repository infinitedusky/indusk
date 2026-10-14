import { execFile } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { type Span, SpanStatusCode, type Tracer, trace } from "@opentelemetry/api";
import matter from "gray-matter";
import { readRegistry, removeProject } from "../admin/registry.js";
import { type InduskConfig, readConfig, writeConfig } from "../config.js";
import { induskMcpPackageRoot } from "../package-root.js";
import { isUnderParent, readParent } from "./parent.js";
import { type Proposal, ProposalError, readProposal } from "./proposal.js";
import {
	type CreationRecord,
	type CreationStepId,
	type CreationStepState,
	creationStepIds,
} from "./steps.js";
import {
	documentsDir,
	findProjectDraft,
	type ProjectDraft,
	projectDraftCreatedAt,
	readProjectDraft,
} from "./store.js";
import { conversationFigures, readTranscript } from "./transcript.js";

/**
 * Making a project (new-project-flow, ADR decision 5) - the one place a
 * proposal becomes disk. This is the standard layout, in the order it is made:
 *
 *   <location>/                  the workbench: InDusk's home, a git repository of its own
 *     <repo>/                    each repository, `git init -b main` with one README commit
 *     worktrees/                 beside the repositories, one folder per plan's branch
 *     package.json               minimal, so the workbench is a project root
 *     .indusk/config.json        `worktree.repos[]` declares every repository and `worktrees`;
 *                                `repos_root: "."` says they live inside the workbench
 *     .indusk/planning/          project-brief.md (the founding brief), sources/ (the person's
 *                                documents, byte for byte), master.md (milestones as `roadmap:`)
 *
 * Order: guard the parent -> workbench -> repositories -> `indusk init` as a
 * child process (it exits the process and writes the console, so never in this
 * one) -> rewrite `worktree` -> documents and config -> commit the workbench
 * -> the remote, only when the proposal confirmed it -> forget the draft. A
 * failure before the remote removes everything the run made - the directories
 * and the registry entry - and keeps the draft; a failed remote leaves the
 * finished local project and says so, because nothing else is wrong.
 *
 * promise: a-new-project-has-the-standard-layout
 * promise: a-new-project-is-made-by-the-agent
 * promise: a-new-project-publishes-nothing-unasked
 * promise: a-new-project-is-written-only-under-its-parent
 */

const exec = promisify(execFile);

/** A creation that cannot go on; the message is for the person. */
export class CreationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CreationError";
	}
}

export interface CreatedProject {
	/** The name the project has in the registry, which `/p/<name>/` answers to. */
	name: string;
	/** The workbench folder. */
	root: string;
	/** Set when the confirmed remote could not be made; the project itself is whole. */
	remoteError?: string;
}

export interface CreateOptions {
	now?: Date;
	/** Where the `new_project.create` span goes; the process's own tracer unless a test says otherwise. */
	tracer?: Tracer;
	/** Called as each step starts, ends, or fails. */
	report?: (step: CreationStepId, state: CreationStepState) => void;
}

/** Run a command; a non-zero exit becomes an Error carrying the end of what it said. */
async function run(
	file: string,
	args: string[],
	cwd: string,
	env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
	try {
		await exec(file, args, { cwd, env, maxBuffer: 16 * 1024 * 1024 });
	} catch (err) {
		const e = err as { stderr?: string; stdout?: string; message: string };
		const said = (e.stderr || e.stdout || e.message).trim().split("\n").slice(-6).join("\n");
		throw new Error(`${file} ${args.slice(0, 2).join(" ")} failed: ${said}`);
	}
}

const git = (cwd: string, args: string[]) => run("git", args, cwd);

/** The first directory on the way to `dir` that does not exist yet, or null when `dir` does. */
function firstMissingAncestor(dir: string): string | null {
	if (existsSync(dir)) return null;
	let missing = dir;
	while (!existsSync(dirname(missing)) && dirname(missing) !== missing) missing = dirname(missing);
	return missing;
}

/** The proposal's check, the parent's guard and the founding brief: refuse before anything is made. */
function guard(home: string, draft: ProjectDraft): { proposal: Proposal; brief: string } {
	const parent = readParent(home);
	if (parent === null) {
		throw new CreationError(
			"No parent directory is set. Set one with: indusk new-project parent <dir>",
		);
	}
	let proposal: Proposal;
	try {
		proposal = readProposal(draft);
	} catch (err) {
		if (err instanceof ProposalError) {
			throw new CreationError(`The proposal for ${draft.id} is refused: ${err.message}`);
		}
		throw err;
	}
	if (!isUnderParent(proposal.location, parent)) {
		throw new CreationError(
			`${proposal.location} is outside the parent directory ${parent}; new projects are made only inside it.`,
		);
	}
	if (existsSync(proposal.location)) {
		throw new CreationError(`${proposal.location} already exists; nothing was changed.`);
	}
	const brief = readProjectDraft(home, draft.id)?.brief;
	if (!brief) throw new CreationError("The agent has not written the founding brief yet.");
	return { proposal, brief };
}

/** The founding brief as a planning document: the agent's words under a `project-brief` header. */
function foundingBrief(proposal: Proposal, brief: string, now: Date): string {
	const body = matter(brief).content.trim();
	return matter.stringify(`${body}\n`, {
		title: `${proposal.name} - founding brief`,
		kind: "project-brief",
		date: now.toISOString().slice(0, 10),
		status: "accepted",
	});
}

/** The root master plan: the milestones, in order, as `roadmap:`. */
function masterPlan(proposal: Proposal, now: Date): string {
	return matter.stringify(
		`# ${proposal.name}\n\nThe order the founding brief's milestones are built in.\n`,
		{
			title: `${proposal.name} - master plan`,
			date: now.toISOString().slice(0, 10),
			roadmap: proposal.milestones,
		},
	);
}

/** The founding brief, the person's documents (byte for byte) and the master plan, under the project's planning folder. */
function writeFoundingDocuments(
	root: string,
	draft: ProjectDraft,
	proposal: Proposal,
	brief: string,
	now: Date,
): void {
	const planning = join(root, ".indusk", "planning");
	mkdirSync(join(planning, "sources"), { recursive: true });
	writeFileSync(join(planning, "project-brief.md"), foundingBrief(proposal, brief, now));
	writeFileSync(join(planning, "master.md"), masterPlan(proposal, now));
	const kept = documentsDir(draft);
	for (const name of existsSync(kept) ? readdirSync(kept) : []) {
		copyFileSync(join(kept, name), join(planning, "sources", name));
	}
}

/** What the person decided - each recommendation kept or declined (with the reason), the documents turned off - in the project's config. */
function recordChoices(root: string, proposal: Proposal): void {
	const config = readConfig(root) as InduskConfig;
	writeConfig(root, {
		...config,
		recommendations: proposal.recommendations.map((rec) => ({
			name: rec.name,
			kept: rec.kept,
			...(rec.kept ? {} : { reason: rec.reason }),
		})),
		...(proposal.documentsOff.length > 0
			? { planning: { ...config.planning, documents_off: proposal.documentsOff } }
			: {}),
	});
}

/** The workbench's own git repository and first commit; the repositories and worktrees inside it are ignored. */
async function commitWorkbench(root: string, proposal: Proposal): Promise<void> {
	await git(root, ["init", "-q", "-b", "main"]);
	const ignored = [...proposal.repos.map((r) => `/${r.name}/`), "/worktrees/"];
	const ignorePath = join(root, ".gitignore");
	const before = existsSync(ignorePath) ? readFileSync(ignorePath, "utf-8").trimEnd() : "";
	writeFileSync(ignorePath, `${before}${before ? "\n" : ""}${ignored.join("\n")}\n`);
	await git(root, ["add", "-A"]);
	await git(root, ["commit", "-q", "-m", `Create the ${proposal.name} workbench`]);
}

/** What a creation has recorded in its draft so far, or null when none has begun (or the record is unreadable). */
export function readCreation(draft: ProjectDraft): CreationRecord | null {
	try {
		const raw = JSON.parse(
			readFileSync(join(draft.dir, "creating.json"), "utf-8"),
		) as CreationRecord;
		return Array.isArray(raw.steps) ? raw : null;
	} catch {
		return null;
	}
}

/** Write the creation's progress into the draft, for a page opened mid-run or after a failure. */
function recorder(draft: ProjectDraft, proposal: Proposal, report: CreateOptions["report"]) {
	const record: CreationRecord = {
		steps: creationStepIds(proposal.remote.github).map((id) => ({ id, state: "waiting" })),
	};
	const write = () =>
		writeFileSync(join(draft.dir, "creating.json"), `${JSON.stringify(record)}\n`);
	write();
	return {
		set(step: CreationStepId, state: CreationStepState, error?: string) {
			const entry = record.steps.find((s) => s.id === step);
			if (entry) entry.state = state;
			if (error !== undefined) record.error = error;
			write();
			report?.(step, state);
		},
	};
}

/**
 * Make the project the draft's proposal describes. Throws a `CreationError`
 * when it is refused (nothing was made) or when a step fails (what was made is
 * removed, the draft stays).
 */
export async function createProject(
	home: string,
	id: string,
	options: CreateOptions = {},
): Promise<CreatedProject> {
	const draft = findProjectDraft(home, id);
	const span = draft ? startCreateSpan(options.tracer, home, draft) : null;
	try {
		const created = await makeProject(home, id, options);
		span?.setAttribute("new_project.name", created.name);
		span?.setAttribute("new_project.remote_failed", created.remoteError !== undefined);
		return created;
	} catch (err) {
		span?.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
		throw err;
	} finally {
		endSpan(span, options.now);
	}
}

const TRACER_NAME = "@infinitedusky/indusk-mcp/new-project";

/**
 * The `new_project.create` span (new-project-flow, OTel): it starts when the
 * person opened the text box, so its duration is expectation 1 (idea to
 * project); the conversation figures are read from the draft's transcript now,
 * before creation deletes the draft - `conversation.questions` and
 * `conversation.has_document` for expectation 2, `conversation.reply_words`
 * and `conversation.folds_opened` for expectation 5. Telemetry is best-effort:
 * a failure here never fails a creation.
 */
function startCreateSpan(
	tracer: Tracer | undefined,
	home: string,
	draft: ProjectDraft,
): Span | null {
	try {
		const created = projectDraftCreatedAt(draft);
		const span = (tracer ?? trace.getTracer(TRACER_NAME)).startSpan(
			"new_project.create",
			created ? { startTime: created } : {},
		);
		const figures = conversationFigures(readTranscript(draft));
		span.setAttribute("conversation.questions", figures.questions);
		span.setAttribute("conversation.replies", figures.replies);
		span.setAttribute("conversation.reply_words", figures.replyWords);
		span.setAttribute("conversation.folds_opened", figures.foldsOpened);
		span.setAttribute(
			"conversation.has_document",
			(readProjectDraft(home, draft.id)?.documents.length ?? 0) > 0,
		);
		return span;
	} catch {
		return null;
	}
}

function endSpan(span: Span | null, now: Date | undefined): void {
	try {
		span?.end(now);
	} catch {
		// best-effort
	}
}

async function makeProject(
	home: string,
	id: string,
	options: CreateOptions,
): Promise<CreatedProject> {
	const { now = new Date(), report } = options;
	const draft = findProjectDraft(home, id);
	if (!draft) throw new CreationError(`No project conversation ${id}.`);
	const { proposal, brief } = guard(home, draft);
	const root = proposal.location;
	const first = proposal.repos[0]?.name as string;
	const progress = recorder(draft, proposal, report);
	const madeFrom = firstMissingAncestor(root) as string;
	let step: CreationStepId = "workbench";
	const begin = (next: CreationStepId) => {
		step = next;
		progress.set(next, "working");
	};

	try {
		begin("workbench");
		mkdirSync(join(root, "worktrees"), { recursive: true });
		writeFileSync(
			join(root, "package.json"),
			`${JSON.stringify({ name: `${proposal.name}-workbench`, version: "0.0.1", private: true }, null, 2)}\n`,
		);
		progress.set("workbench", "done");

		begin("repository");
		for (const { name } of proposal.repos) {
			const repo = join(root, name);
			mkdirSync(repo, { recursive: true });
			await git(repo, ["init", "-q", "-b", "main"]);
			writeFileSync(join(repo, "README.md"), `# ${name}\n`);
			await git(repo, ["add", "README.md"]);
			await git(repo, ["commit", "-q", "-m", "Initial commit"]);
		}
		progress.set("repository", "done");

		begin("install");
		await run(
			process.execPath,
			[
				join(induskMcpPackageRoot(), "dist", "bin", "cli.js"),
				"init",
				"--workbench",
				"--wrapped-repo",
				first,
				"--sibling-parent",
				root,
				"--no-index",
			],
			root,
		);
		const config = readConfig(root) as InduskConfig;
		writeConfig(root, {
			...config,
			worktree: {
				shape: "workbench",
				repos: proposal.repos.map(({ name }) => ({ name, worktrees: "worktrees" })),
				repos_root: ".",
			},
		});
		progress.set("install", "done");

		begin("documents");
		writeFoundingDocuments(root, draft, proposal, brief, now);
		recordChoices(root, proposal);
		await commitWorkbench(root, proposal);
		progress.set("documents", "done");
	} catch (err) {
		const message = (err as Error).message;
		progress.set(step, "failed", message);
		rmSync(madeFrom, { recursive: true, force: true });
		removeProject(root);
		throw new CreationError(
			`Making ${proposal.name} failed at "${step}" and what it made was removed: ${message}`,
		);
	}

	const entry = readRegistry().projects.find((p) => p.path === root);
	const created: CreatedProject = { name: entry?.name ?? proposal.name, root };

	if (proposal.remote.github) {
		begin("github");
		try {
			await run(
				"gh",
				["repo", "create", first, "--private", "--source", join(root, first), "--push"],
				join(root, first),
			);
			progress.set("github", "done");
		} catch (err) {
			created.remoteError = (err as Error).message;
			progress.set("github", "failed", created.remoteError);
		}
	}

	rmSync(draft.dir, { recursive: true, force: true });
	return created;
}
