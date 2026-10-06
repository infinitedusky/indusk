import { type ChildProcess, spawn } from "node:child_process";
import {
	answerQuestion,
	buildArgs,
	decidePermission,
	interrupt,
	type PermissionEvent,
	parseSessionLine,
	type QuestionEvent,
	type SessionEvent,
	type SessionKind,
	userMessage,
} from "./protocol.js";
import { projectOf, trustLikeProject } from "./trust.js";

/**
 * A session of the developer's own `claude` (admin-plan-authoring, ADR D1):
 * the process, its stdin and stdout, and nothing else. What its lines mean is
 * `protocol.ts`'s; who owns the session is the manager's.
 *
 * A plan's worktree is a new path Claude Code has never trusted. Before the
 * session starts, a worktree of a trusted project is trusted like it
 * (`trust.ts`); one that stays untrusted still runs, ignoring its own
 * allow-list, and the session says which as its first event.
 */

export type StartedEvent =
	| SessionEvent
	/** Trusted like its project just now, or still untrusted: its allow-list is ignored, so more is asked. */
	| { type: "trusted" | "untrusted"; cwd: string }
	| { type: "exit"; code: number | null; stderr: string };

export interface SessionOptions {
	cwd: string;
	kind: SessionKind;
	/** The first message: a request like `/planner feature seat-holds`, or a step of a build. */
	prompt: string;
	onEvent: (event: StartedEvent) => void;
	/** The `claude` to run; the developer's own on PATH unless a test says otherwise. */
	claudeBin?: string;
	/** A model alias for `--model`; the developer's own default when absent. */
	model?: string;
	env?: NodeJS.ProcessEnv;
	/** Where Claude Code keeps its trust records; `~/.claude.json` unless a test says otherwise. */
	claudeConfig?: string;
}

export interface Session {
	pid: number;
	kind: SessionKind;
	cwd: string;
	say(text: string): void;
	answer(ev: QuestionEvent, answers: Record<string, string>): void;
	decide(ev: PermissionEvent, decision: { allow: true } | { allow: false; message: string }): void;
	/** Interrupt, then end the process if it has not ended within `graceMs`. Resolves when it has exited. */
	stop(graceMs?: number): Promise<void>;
	/** Resolves with the exit code when the process ends, however it ends. */
	done: Promise<number | null>;
}

export function startSession(opts: SessionOptions): Session {
	const args = [...buildArgs(opts.kind), ...(opts.model ? ["--model", opts.model] : [])];
	const child: ChildProcess = spawn(opts.claudeBin ?? "claude", args, {
		cwd: opts.cwd,
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env, ...opts.env },
	});
	if (typeof child.pid !== "number")
		throw new Error(`could not start ${opts.claudeBin ?? "claude"}`);

	const trust = trustLikeProject(opts.cwd, projectOf(opts.cwd), opts.claudeConfig);
	if (trust !== "already") opts.onEvent({ type: trust, cwd: opts.cwd });

	let buffer = "";
	let stderr = "";
	child.stdout?.on("data", (chunk: Buffer) => {
		buffer += chunk.toString();
		for (let i = buffer.indexOf("\n"); i >= 0; i = buffer.indexOf("\n")) {
			const line = buffer.slice(0, i);
			buffer = buffer.slice(i + 1);
			for (const event of parseSessionLine(line)) opts.onEvent(event);
		}
	});
	child.stderr?.on("data", (chunk: Buffer) => {
		stderr = (stderr + chunk.toString()).slice(-4000);
	});
	const done = new Promise<number | null>((resolve) => {
		child.once("close", (code) => {
			opts.onEvent({ type: "exit", code, stderr });
			resolve(code);
		});
	});

	const write = (line: string) => {
		if (child.stdin?.writable) child.stdin.write(`${line}\n`);
	};
	let interrupts = 0;

	write(userMessage(opts.prompt));
	return {
		pid: child.pid,
		kind: opts.kind,
		cwd: opts.cwd,
		say: (text) => write(userMessage(text)),
		answer: (ev, answers) => write(answerQuestion(ev, answers)),
		decide: (ev, decision) => write(decidePermission(ev, decision)),
		async stop(graceMs = 5000) {
			if (child.exitCode !== null || child.signalCode !== null) return;
			write(interrupt(`stop-${++interrupts}`));
			child.stdin?.end();
			const timer = setTimeout(() => child.kill("SIGTERM"), graceMs);
			await done;
			clearTimeout(timer);
		},
		done,
	};
}
