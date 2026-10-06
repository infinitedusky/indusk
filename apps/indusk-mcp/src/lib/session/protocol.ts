/**
 * The stream protocol between InDusk and the developer's own `claude`
 * (admin-plan-authoring, ADR D1). Pure: lines in, events out; answers in,
 * reply lines out. The process is `start.ts`'s; the panel reads events and
 * never parses Claude's lines itself.
 *
 * `claude -p --input-format stream-json --output-format stream-json
 * --permission-prompt-tool stdio` writes one JSON object per line. A
 * question (`AskUserQuestion`) and a request to use a tool both arrive as a
 * `control_request` of subtype `can_use_tool`, answered by a
 * `control_response` with `behavior: allow | deny`. The flag is not in
 * `claude --help`; the contract test (`session-protocol-contract.test.ts`)
 * runs the real CLI through these exchanges at every landing and release.
 */

export type SessionKind = "planning" | "build";

export interface QuestionOption {
	label: string;
	description?: string;
}

export interface Question {
	question: string;
	header?: string;
	options: QuestionOption[];
	multiSelect?: boolean;
}

export type SessionEvent =
	| { type: "init"; sessionId: string; model: string; version: string; cwd: string }
	| { type: "text"; text: string }
	| { type: "tool"; name: string; input: Record<string, unknown> }
	| { type: "question"; requestId: string; questions: Question[]; input: Record<string, unknown> }
	| { type: "permission"; requestId: string; tool: string; input: Record<string, unknown> }
	| { type: "ack"; requestId: string }
	| { type: "result"; ok: boolean; subtype: string; text: string; sessionId: string }
	| { type: "other"; text: string };

export type PermissionEvent = Extract<SessionEvent, { type: "permission" }>;
export type QuestionEvent = Extract<SessionEvent, { type: "question" }>;

/** The flags every session starts with; `kind` decides what is asked. Never bypasses permissions. */
export function buildArgs(kind: SessionKind): string[] {
	return [
		"-p",
		"--input-format",
		"stream-json",
		"--output-format",
		"stream-json",
		"--verbose",
		"--permission-prompt-tool",
		"stdio",
		// A planning session asks before every write, whatever the developer's
		// own default (the spike's first run wrote outside the project unasked
		// under `auto`). A build accepts edits; its other requests are decided
		// in code (`permissions.ts`).
		"--permission-mode",
		kind === "planning" ? "default" : "acceptEdits",
	];
}

/** One line Claude wrote, as the events it carries — an assistant message can carry several. */
export function parseSessionLine(line: string): SessionEvent[] {
	const trimmed = line.trim();
	if (!trimmed) return [];
	let ev: Record<string, unknown>;
	try {
		ev = JSON.parse(trimmed);
	} catch {
		return [{ type: "other", text: trimmed }];
	}
	switch (ev.type) {
		case "system":
			return ev.subtype === "init"
				? [
						{
							type: "init",
							sessionId: String(ev.session_id ?? ""),
							model: String(ev.model ?? ""),
							version: String(ev.claude_code_version ?? ""),
							cwd: String(ev.cwd ?? ""),
						},
					]
				: [];
		case "assistant":
			return assistantEvents(ev.message as { content?: unknown[] } | undefined);
		case "control_request":
			return controlRequestEvents(
				String(ev.request_id ?? ""),
				ev.request as Record<string, unknown>,
			);
		case "control_response": {
			const response = ev.response as { request_id?: string } | undefined;
			return [{ type: "ack", requestId: String(response?.request_id ?? "") }];
		}
		case "result":
			return [
				{
					type: "result",
					ok: ev.is_error !== true && ev.subtype === "success",
					subtype: String(ev.subtype ?? ""),
					text: String(ev.result ?? ""),
					sessionId: String(ev.session_id ?? ""),
				},
			];
		default:
			// Tool results, rate-limit notices: Claude's bookkeeping, not what it says.
			return [];
	}
}

function assistantEvents(message: { content?: unknown[] } | undefined): SessionEvent[] {
	const out: SessionEvent[] = [];
	for (const block of message?.content ?? []) {
		const b = block as {
			type?: string;
			text?: string;
			name?: string;
			input?: Record<string, unknown>;
		};
		if (b.type === "text" && b.text) out.push({ type: "text", text: b.text });
		if (b.type === "tool_use" && b.name)
			out.push({ type: "tool", name: b.name, input: b.input ?? {} });
	}
	return out;
}

function controlRequestEvents(
	requestId: string,
	request: Record<string, unknown> | undefined,
): SessionEvent[] {
	if (request?.subtype !== "can_use_tool")
		return [{ type: "other", text: JSON.stringify(request ?? {}) }];
	const input = (request.input ?? {}) as Record<string, unknown>;
	if (request.tool_name === "AskUserQuestion") {
		return [
			{ type: "question", requestId, questions: (input.questions ?? []) as Question[], input },
		];
	}
	return [{ type: "permission", requestId, tool: String(request.tool_name ?? ""), input }];
}

/** The line that starts or continues the conversation with what a person typed. */
export function userMessage(text: string): string {
	return JSON.stringify({ type: "user", message: { role: "user", content: text } });
}

/** The reply to a question: allow, with the person's answer per question (question text → chosen label). */
export function answerQuestion(ev: QuestionEvent, answers: Record<string, string>): string {
	return controlResponse(ev.requestId, {
		behavior: "allow",
		updatedInput: { ...ev.input, answers },
	});
}

/** The reply to a request to use a tool. A denial carries its reason, so the session hears why. */
export function decidePermission(
	ev: PermissionEvent,
	decision: { allow: true } | { allow: false; message: string },
): string {
	return controlResponse(
		ev.requestId,
		decision.allow
			? { behavior: "allow", updatedInput: ev.input }
			: { behavior: "deny", message: decision.message },
	);
}

/** Ask the session to stop what it is doing; it ends with an error result. */
export function interrupt(requestId: string): string {
	return JSON.stringify({
		type: "control_request",
		request_id: requestId,
		request: { subtype: "interrupt" },
	});
}

function controlResponse(requestId: string, response: Record<string, unknown>): string {
	return JSON.stringify({
		type: "control_response",
		response: { subtype: "success", request_id: requestId, response },
	});
}
