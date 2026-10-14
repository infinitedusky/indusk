import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Span, Tracer } from "@opentelemetry/api";
import { afterEach, describe, expect, it } from "vitest";
import { CreationError, createProject } from "./create.js";
import { setParent } from "./parent.js";
import { createProjectDraft } from "./store.js";
import {
	appendTranscript,
	conversationFigures,
	readTranscript,
	recordFoldOpened,
	type TranscriptLine,
} from "./transcript.js";

// promise: a-project-conversation-is-a-back-and-forth

const text = (t: string): TranscriptLine => ({ type: "text", text: t });
const result: TranscriptLine = {
	type: "result",
	ok: true,
	subtype: "success",
	text: "",
	sessionId: "s",
};

describe("conversationFigures — what the creation span carries about the conversation", () => {
	it("counts a reply as the last text of each turn, with its words, the questions asked and the folds opened", () => {
		const lines: TranscriptLine[] = [
			{ type: "session", id: "a" },
			text("Reading the brief."),
			text("Is mobile an app? Where does it run?"),
			result,
			{ type: "you", text: "An app, on Fly." },
			text("Got it."),
			result,
			{ type: "fold-opened", at: "2026-10-14T10:00:00.000Z" },
			{ type: "fold-opened", at: "2026-10-14T10:00:01.000Z" },
		];
		expect(conversationFigures(lines)).toEqual({
			questions: 2,
			replies: 2,
			replyWords: 5,
			foldsOpened: 2,
			toolsRefused: 0,
		});
	});

	it("counts the questions asked through the question tool, and ignores a ? inside code", () => {
		const lines: TranscriptLine[] = [
			{
				type: "question",
				requestId: "r",
				questions: [
					{ question: "Where?", options: [] },
					{ question: "Name?", options: [] },
				],
				input: {},
			},
			text("Try `a?b` then."),
			result,
		];
		expect(conversationFigures(lines).questions).toBe(2);
	});

	it("is zero for a conversation with no replies", () => {
		expect(conversationFigures([])).toEqual({
			questions: 0,
			replies: 0,
			replyWords: 0,
			foldsOpened: 0,
			toolsRefused: 0,
		});
	});
});

describe("the transcript file", () => {
	const made: string[] = [];
	afterEach(() => {
		for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
	});
	const home = () => {
		const dir = mkdtempSync(join(tmpdir(), "transcript-"));
		made.push(dir);
		return dir;
	};

	it("keeps what is appended, in order, and skips a torn last line", () => {
		const h = home();
		const draft = createProjectDraft(h, { message: "x" });
		appendTranscript(draft, { type: "session", id: "a" });
		recordFoldOpened(draft, new Date("2026-10-14T10:00:00.000Z"));
		writeFileSync(join(draft.dir, "transcript.jsonl"), '{"type":"text"', { flag: "a" });
		expect(readTranscript(draft)).toEqual([
			{ type: "session", id: "a" },
			{ type: "fold-opened", at: "2026-10-14T10:00:00.000Z" },
		]);
	});

	it("writes nothing for a draft that is already gone, and does not recreate its folder", () => {
		const h = home();
		const draft = createProjectDraft(h, { message: "x" });
		rmSync(draft.dir, { recursive: true });
		expect(() => appendTranscript(draft, { type: "session", id: "a" })).not.toThrow();
		expect(readTranscript(draft)).toEqual([]);
	});
});

describe("createProject's span", () => {
	const made: string[] = [];
	afterEach(() => {
		for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
	});

	it("emits new_project.create from the draft's start with the conversation figures, and marks a refused creation an error", async () => {
		const h = mkdtempSync(join(tmpdir(), "create-span-"));
		made.push(h);
		mkdirSync(h, { recursive: true });
		const draft = createProjectDraft(
			h,
			{ message: "x", documents: [{ name: "spec.md", content: "# s\n" }] },
			new Date("2026-10-14T09:00:00.000Z"),
		);
		appendTranscript(draft, text("One question? And another?"));
		appendTranscript(draft, { type: "fold-opened", at: "2026-10-14T09:01:00.000Z" });
		appendTranscript(draft, { type: "refused", tool: "Bash" });
		appendTranscript(draft, { type: "refused", tool: "WebFetch" });
		setParent(join(h, "code"), h, "admin");

		const seen: {
			name?: string;
			start?: unknown;
			attrs: Record<string, unknown>;
			status?: unknown;
			ended: boolean;
		} = {
			attrs: {},
			ended: false,
		};
		const tracer = {
			startSpan: (name: string, opts?: { startTime?: unknown }) => {
				seen.name = name;
				seen.start = opts?.startTime;
				return {
					setAttribute: (k: string, v: unknown) => {
						seen.attrs[k] = v;
					},
					setStatus: (s: unknown) => {
						seen.status = s;
					},
					end: () => {
						seen.ended = true;
					},
				} as unknown as Span;
			},
		} as unknown as Tracer;

		// The draft holds no proposal, so creation is refused - the span still reports it.
		const prev = process.env.INDUSK_HOME;
		process.env.INDUSK_HOME = h;
		try {
			await expect(createProject(h, draft.id, { tracer })).rejects.toBeInstanceOf(CreationError);
		} finally {
			if (prev === undefined) delete process.env.INDUSK_HOME;
			else process.env.INDUSK_HOME = prev;
		}
		expect(seen.name).toBe("new_project.create");
		expect(seen.start).toEqual(new Date("2026-10-14T09:00:00.000Z"));
		expect(seen.attrs).toMatchObject({
			"conversation.questions": 2,
			"conversation.has_document": true,
			"conversation.reply_words": 4,
			"conversation.folds_opened": 1,
			"conversation.tools_refused": 2,
			"new_project.parent_set_in_admin": true,
			"new_project.remote_visibility": "none",
		});
		expect(seen.status).toMatchObject({ code: 2 });
		expect(seen.ended).toBe(true);
	});
	it("carries who can see the repository the proposal confirmed", async () => {
		const h = mkdtempSync(join(tmpdir(), "create-span-"));
		made.push(h);
		const draft = createProjectDraft(h, { message: "x", documents: [] });
		const proposal = {
			name: "demo",
			location: join(h, "code", "demo-workbench"),
			repos: [{ name: "demo" }],
			milestones: ["first"],
			recommendations: [],
			documentsOff: [],
			remote: { github: true, visibility: "public" },
		};
		writeFileSync(join(draft.dir, "proposal.json"), JSON.stringify(proposal));
		const attrs: Record<string, unknown> = {};
		const tracer = {
			startSpan: () =>
				({
					setAttribute: (k: string, v: unknown) => {
						attrs[k] = v;
					},
					setStatus: () => {},
					end: () => {},
				}) as unknown as Span,
		} as unknown as Tracer;
		// No parent is set, so creation is refused before anything is made; the span still says what was confirmed.
		await expect(createProject(h, draft.id, { tracer })).rejects.toBeInstanceOf(CreationError);
		expect(attrs["new_project.remote_visibility"]).toBe("public");
	});
});
