import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decideBuildPermission, refuseBuildQuestion } from "./permissions.js";
import {
	answerQuestion,
	buildArgs,
	decidePermission,
	interrupt,
	parseSessionLine,
	type SessionEvent,
	userMessage,
} from "./protocol.js";

/**
 * promise: a-plan-can-start-from-the-admin — admin-plan-authoring A1, A2, A3, A4, the protocol's half.
 * promise: a-build-runs-to-review-unasked — admin-plan-authoring A30, the worktree half.
 *
 * The admin drives the developer's own `claude` over its stream protocol
 * (ADR D1). These are real exchanges, recorded from Claude Code 2.1.197 in the
 * 2026-10-05 spike and trimmed (`__fixtures__/`): `<<` is a line Claude wrote,
 * `>>` the reply that continued it. The functions turn Claude's lines into
 * events a panel can show, and a person's answers into the replies Claude
 * accepted. Whether Claude still speaks this protocol is A5's question.
 */

type Exchange = { from: "claude" | "us"; json: Record<string, unknown>; raw: string };

function fixture(name: string): Exchange[] {
	return readFileSync(join(__dirname, "__fixtures__", name), "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => ({
			from: line.startsWith("<<") ? "claude" : "us",
			raw: line.slice(3),
			json: JSON.parse(line.slice(3)),
		}));
}

const fromClaude = (ex: Exchange[]) => ex.filter((e) => e.from === "claude");
const eventsOf = (ex: Exchange[]): SessionEvent[] =>
	fromClaude(ex).flatMap((e) => parseSessionLine(e.raw));

describe("A1 — what the session says becomes events, as it says it", () => {
	it("the start, the text, the tool it uses and the result, in order", () => {
		const events = eventsOf(fixture("question.jsonl"));
		expect(events[0]).toMatchObject({ type: "init", version: "2.1.197" });
		expect(events.some((e) => e.type === "tool" && e.name === "AskUserQuestion")).toBe(true);
		expect(events.at(-1)).toMatchObject({ type: "result", ok: true });
	});

	it("a line that is not JSON is kept as text, never dropped", () => {
		expect(parseSessionLine("Warning: something odd")).toEqual([
			{ type: "other", text: "Warning: something odd" },
		]);
	});

	it("the first message a person types becomes the line Claude reads", () => {
		expect(JSON.parse(userMessage("/planner feature seat-holds"))).toEqual({
			type: "user",
			message: { role: "user", content: "/planner feature seat-holds" },
		});
	});
});

describe("A2 — a question arrives with its choices; the answer continues the session", () => {
	const ex = fixture("question.jsonl");
	const question = eventsOf(ex).find((e) => e.type === "question");

	it("the question event carries each question with its options", () => {
		expect(question).toMatchObject({
			type: "question",
			questions: [
				{
					header: "CLI shape",
					options: [{ label: "New minimal script (Recommended)" }, { label: "Tell me where" }],
				},
				{ header: "Output behavior" },
			],
		});
	});

	it("the reply is the one Claude accepted: allow, the input, and an answer per question", () => {
		if (question?.type !== "question") throw new Error("no question event");
		const sent = ex.find((e) => e.from === "us")?.json as {
			response: { response: { updatedInput: { answers: Record<string, string> } } };
		};
		const answers = sent.response.response.updatedInput.answers;
		expect(JSON.parse(answerQuestion(question, answers))).toEqual(sent);
	});
});

describe("A3 — a tool-use request arrives; allow lets it run, deny says no", () => {
	const ex = fixture("permission.jsonl");
	const requests = eventsOf(ex).filter((e) => e.type === "permission");

	it("each request names the tool and its input", () => {
		expect(requests.map((r) => (r.type === "permission" ? r.tool : null))).toEqual([
			"Write",
			"Bash",
		]);
		expect(requests[0]).toMatchObject({ input: { file_path: expect.any(String) } });
	});

	it("allow is the reply Claude accepted", () => {
		const sent = ex.filter((e) => e.from === "us")[0].json;
		const first = requests[0];
		if (first.type !== "permission") throw new Error("no permission event");
		expect(JSON.parse(decidePermission(first, { allow: true }))).toEqual(sent);
	});

	it("deny carries the reason, so the session hears why", () => {
		const first = requests[0];
		if (first.type !== "permission") throw new Error("no permission event");
		expect(
			JSON.parse(decidePermission(first, { allow: false, message: "not outside the plan" })),
		).toEqual({
			type: "control_response",
			response: {
				subtype: "success",
				request_id: first.requestId,
				response: { behavior: "deny", message: "not outside the plan" },
			},
		});
	});

	it("an interrupt is the request Claude acknowledged, and the session ends in an error result", () => {
		const ex2 = fixture("interrupt.jsonl");
		expect(JSON.parse(interrupt("int-1"))).toEqual(ex2[0].json);
		const events = eventsOf(ex2);
		expect(events[0]).toEqual({ type: "ack", requestId: "int-1" });
		expect(events.at(-1)).toMatchObject({
			type: "result",
			ok: false,
			subtype: "error_during_execution",
		});
	});
});

describe("A4 — a planning session asks before every write", () => {
	it("a planning session runs in permission mode default, whatever the developer's own default is", () => {
		const args = buildArgs("planning");
		expect(
			args.slice(args.indexOf("--permission-mode"), args.indexOf("--permission-mode") + 2),
		).toEqual(["--permission-mode", "default"]);
		expect(args).toEqual(expect.arrayContaining(["--permission-prompt-tool", "stdio"]));
	});

	it("a build accepts edits — its writes are judged in code, inside its worktree", () => {
		const args = buildArgs("build");
		expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
	});

	it("neither kind ever bypasses permissions", () => {
		for (const kind of ["planning", "build"] as const) {
			expect(buildArgs(kind).join(" ")).not.toMatch(/bypassPermissions|dangerously/);
		}
	});
});

describe("A30 — a build writes inside its worktree without asking, and is refused outside it", () => {
	const worktree = "/Users/dev/code/proj-worktrees/seat-holds";
	const request = (input: Record<string, unknown>, tool = "Write") =>
		({ type: "permission", requestId: "r1", tool, input }) as const;

	it("a path inside the worktree is allowed", () => {
		expect(
			decideBuildPermission(request({ file_path: `${worktree}/src/seat.ts` }), worktree),
		).toEqual({
			allow: true,
		});
		expect(decideBuildPermission(request({ file_path: "src/seat.ts" }), worktree)).toEqual({
			allow: true,
		});
	});

	it("a path outside it, or climbing out of it, is refused, naming the worktree", () => {
		for (const file_path of [
			"/Users/dev/code/proj/src/seat.ts",
			`${worktree}/../proj/README.md`,
			"../../etc/hosts",
		]) {
			const d = decideBuildPermission(request({ file_path }), worktree);
			expect(d.allow, file_path).toBe(false);
			if (!d.allow) expect(d.message).toContain(worktree);
		}
	});

	it("a sibling whose name starts like the worktree is outside it", () => {
		expect(
			decideBuildPermission(request({ file_path: `${worktree}-old/x.ts` }), worktree).allow,
		).toBe(false);
	});

	it("a tool given no path runs in the worktree, and the hooks still judge it", () => {
		expect(decideBuildPermission(request({ command: "pnpm test" }, "Bash"), worktree)).toEqual({
			allow: true,
		});
	});

	it("a build's question is answered by telling it to decide and record why", () => {
		const d = refuseBuildQuestion({ type: "question", requestId: "q1", questions: [], input: {} });
		expect(d.allow).toBe(false);
		if (!d.allow) expect(d.message).toMatch(/own judgement/);
	});
});
