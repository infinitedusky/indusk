import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { isAlive, realProcessReads } from "../process-identity.js";
import { readSessionsMax } from "./limits.js";
import { decideBuildPermission } from "./permissions.js";
import type { QuestionEvent, SessionKind } from "./protocol.js";
import { type Session, type SessionOptions, type StartedEvent, startSession } from "./start.js";

/**
 * Who owns the sessions the admin starts (admin-plan-authoring, ADR D2): the
 * admin daemon, through one manager. A session is owned by its project, plan
 * and kind (sessions-per-plan), and the machine runs at most `sessions.max`;
 * each is written to a
 * record (`~/.indusk/admin-sessions.json`) so `indusk ui stop` can end them
 * and a daemon starting after a crash can end what its predecessor left.
 *
 * The manager keeps each session's events so a panel that connects after the
 * session started still sees all of it, then hears the rest as it happens.
 *
 * promise: a-session-can-be-stopped
 */

/** The refusal of a second session of a kind on a plan that has one: said plainly, offering to continue it. */
export function alreadyRunningOnThisPlan(running: Pick<SessionRecord, "kind" | "plan">): string {
	return `A ${running.kind} session is already running on this plan (${running.plan}). Do you want to continue that session here?`;
}

export class SessionBusy extends Error {
	/** The session already running on this plan, when that is why: the person may continue it instead. */
	readonly running?: SessionRecord;

	constructor(message: string, running?: SessionRecord) {
		super(message);
		if (running) this.running = running;
	}
}

export interface SessionRecord {
	id: string;
	pid: number;
	/** The program started, to tell our process from another that reused its pid. */
	bin: string;
	cwd: string;
	project: string;
	plan: string;
	kind: SessionKind;
	startedAt: string;
}

export interface ManagedStart extends SessionOptions {
	project: string;
	plan: string;
}

interface Held {
	record: SessionRecord;
	session: Session;
	events: StartedEvent[];
	listeners: Set<(ev: StartedEvent) => void>;
	answered: Set<string>;
}

export function defaultRecordPath(): string {
	return join(process.env.INDUSK_HOME ?? join(homedir(), ".indusk"), "admin-sessions.json");
}

const buildKey = (project: string, plan: string): string => `${project}\0${plan}`;

export class SessionManager {
	private readonly recordPath: string;
	private readonly launch: (opts: SessionOptions) => Session;
	private readonly held = new Map<string, Held>();
	private readonly max: number | undefined;
	/** Builds admitted under the cap, by `project\0plan`: each holds one place from its start to its end. */
	private readonly builds = new Set<string>();

	constructor(
		opts: { recordPath?: string; start?: (opts: SessionOptions) => Session; max?: number } = {},
	) {
		this.recordPath = opts.recordPath ?? defaultRecordPath();
		this.launch = opts.start ?? startSession;
		this.max = opts.max;
	}

	/**
	 * Start a session. Refused when the same plan already has one of this kind,
	 * or when the machine already runs its cap.
	 */
	start(opts: ManagedStart): { id: string; session: Session } {
		const refusal = this.refusalFor(opts);
		if (refusal) throw refusal;
		const id = randomUUID();
		const holder: Held = {
			record: undefined as unknown as SessionRecord,
			session: undefined as unknown as Session,
			events: [],
			listeners: new Set(),
			answered: new Set(),
		};
		const session = this.launch({
			...opts,
			onEvent: (ev) => {
				// A planning session is asked only about a path outside its own
				// folder (A26): the rest is decided here, as a build's is.
				if (opts.kind === "planning" && ev.type === "permission") {
					const decision = decideBuildPermission(ev, [opts.cwd, ...(opts.addDirs ?? [])]);
					if (decision.allow) {
						holder.session.decide(ev, decision);
						return;
					}
				}
				holder.events.push(ev);
				opts.onEvent(ev);
				for (const listen of holder.listeners) listen(ev);
			},
		});
		holder.session = session;
		holder.record = {
			id,
			pid: session.pid,
			bin: opts.claudeBin ?? "claude",
			cwd: opts.cwd,
			project: opts.project,
			plan: opts.plan,
			kind: opts.kind,
			startedAt: new Date().toISOString(),
		};
		this.held.set(id, holder);
		this.write();
		session.done.then(() => {
			this.held.delete(id);
			this.write();
		});
		return { id, session };
	}

	/** The session `id`, or undefined. */
	get(id: string): Session | undefined {
		return this.held.get(id)?.session;
	}

	/** Why `opts` may not start now: the plan already has this kind, or the machine is at its cap. */
	private refusalFor(opts: ManagedStart): SessionBusy | undefined {
		const same = this.forPlan(opts.project, opts.plan, opts.kind);
		if (same) {
			return new SessionBusy(alreadyRunningOnThisPlan(same), same);
		}
		// An admitted build's step takes the place its build already holds.
		if (opts.kind === "build" && this.builds.has(buildKey(opts.project, opts.plan)))
			return undefined;
		return this.capRefusal();
	}

	/**
	 * Admit a build under the cap: it holds one place from now until the
	 * returned function is called, whether or not one of its steps is running —
	 * so another plan's start between two steps cannot take it. Refused at the cap.
	 */
	admitBuild(project: string, plan: string): () => void {
		const refusal = this.capRefusal();
		if (refusal) throw refusal;
		const key = buildKey(project, plan);
		this.builds.add(key);
		return () => {
			this.builds.delete(key);
		};
	}

	/** The refusal a new session meets when the machine already runs its cap, if it does. */
	capRefusal(): SessionBusy | undefined {
		const max = this.max ?? readSessionsMax();
		// Each admitted build is one place; its running step is inside that place.
		const unadmitted = this.running().filter(
			(r) => !(r.kind === "build" && this.builds.has(buildKey(r.project, r.plan))),
		);
		if (this.builds.size + unadmitted.length < max) return undefined;
		const names = [
			...[...this.builds].map((k) => `build for ${k.split("\0")[1]}`),
			...unadmitted.map((r) => `${r.kind} for ${r.plan}`),
		];
		return new SessionBusy(
			`${max} sessions are running (sessions.max): ${names.join(", ")} — stop one from its plan's page in the admin`,
		);
	}

	/** The plan's running session of `kind` (either kind when omitted), if any. */
	forPlan(project: string, plan: string, kind?: SessionKind): SessionRecord | undefined {
		return this.running().find(
			(r) => r.project === project && r.plan === plan && (kind === undefined || r.kind === kind),
		);
	}

	/** Every running session's record. */
	running(): SessionRecord[] {
		return [...this.held.values()].map((h) => h.record);
	}

	/**
	 * The question session `id` asked most recently that nobody has answered
	 * yet, if any — what the cockpit's Needs you and decision card wait on
	 * (plan-cockpit, ADR decision 4). Answered through `reply`, like the panel's.
	 */
	pendingQuestion(id: string): QuestionEvent | undefined {
		const h = this.held.get(id);
		if (!h) return undefined;
		for (let i = h.events.length - 1; i >= 0; i--) {
			const ev = h.events[i];
			if (ev?.type === "question" && !h.answered.has(ev.requestId)) return ev;
		}
		return undefined;
	}

	/** Every event so far, then each new one, until the returned function is called. */
	subscribe(id: string, listen: (ev: StartedEvent) => void): () => void {
		const h = this.held.get(id);
		if (!h) throw new Error(`no session ${id}`);
		for (const ev of h.events) listen(ev);
		h.listeners.add(listen);
		return () => h.listeners.delete(listen);
	}

	/**
	 * Answer what session `id` asked, by the request's id: a question with the
	 * person's answers (question text → label), a tool request with allow or
	 * deny. Refuses a request the session never made or already had answered.
	 */
	reply(
		id: string,
		reply:
			| { requestId: string; answers: Record<string, string> }
			| { requestId: string; allow: true }
			| { requestId: string; allow: false; message: string },
	): void {
		const h = this.held.get(id);
		if (!h) throw new Error(`no session ${id} is running`);
		if (h.answered.has(reply.requestId))
			throw new Error(`request ${reply.requestId} was already answered`);
		const asked = h.events.find(
			(e) => (e.type === "question" || e.type === "permission") && e.requestId === reply.requestId,
		);
		if (!asked) throw new Error(`session ${id} made no request ${reply.requestId}`);
		if (asked.type === "question") {
			if ("answers" in reply) {
				h.session.answer(asked, reply.answers);
			} else if (!reply.allow) {
				// A question can be declined like any request: a build asks no one,
				// and tells the session to decide on its own (permissions.ts).
				h.session.decide(
					{
						type: "permission",
						requestId: asked.requestId,
						tool: "AskUserQuestion",
						input: asked.input,
					},
					{ allow: false, message: reply.message },
				);
			} else {
				throw new Error(`request ${reply.requestId} is a question: answer it or decline it`);
			}
		} else if (asked.type === "permission") {
			if (!("allow" in reply))
				throw new Error(`request ${reply.requestId} asks to use ${asked.tool}: allow or deny it`);
			h.session.decide(
				asked,
				reply.allow ? { allow: true } : { allow: false, message: reply.message },
			);
		}
		h.answered.add(reply.requestId);
	}

	/**
	 * Say something to session `id` in the person's own words — a planning
	 * conversation is more than its multiple-choice questions. Recorded as a
	 * `you` event, so the panel shows both sides.
	 */
	say(id: string, text: string): void {
		const h = this.held.get(id);
		if (!h) throw new Error(`no session ${id} is running`);
		if (!text.trim()) throw new Error("a message to the session cannot be empty");
		h.session.say(text);
		const ev: StartedEvent = { type: "you", text };
		h.events.push(ev);
		for (const listen of h.listeners) listen(ev);
	}

	async stop(id: string, graceMs?: number): Promise<void> {
		const h = this.held.get(id);
		if (!h) throw new Error(`no session ${id} is running`);
		await h.session.stop(graceMs);
		this.held.delete(id);
		this.write();
	}

	async stopAll(graceMs?: number): Promise<void> {
		await Promise.all([...this.held.keys()].map((id) => this.stop(id, graceMs)));
	}

	/**
	 * End every session a previous daemon recorded and did not stop: a recorded
	 * pid still alive and still running the program it started. A pid now held
	 * by some other program is left alone. Returns the pids ended.
	 */
	async reapRecorded(graceMs = 3000): Promise<number[]> {
		const recorded = this.read().filter((r) => !this.held.has(r.id));
		const ended: number[] = [];
		for (const r of recorded) {
			if (!isAlive(r.pid) || !(realProcessReads.command(r.pid) ?? "").includes(r.bin)) continue;
			process.kill(r.pid, "SIGTERM");
			const deadline = Date.now() + graceMs;
			while (isAlive(r.pid) && Date.now() < deadline)
				await new Promise((res) => setTimeout(res, 50));
			if (isAlive(r.pid)) process.kill(r.pid, "SIGKILL");
			ended.push(r.pid);
		}
		this.write();
		return ended;
	}

	private read(): SessionRecord[] {
		if (!existsSync(this.recordPath)) return [];
		try {
			const body = JSON.parse(readFileSync(this.recordPath, "utf-8")) as {
				sessions?: SessionRecord[];
			};
			return Array.isArray(body.sessions) ? body.sessions : [];
		} catch {
			return [];
		}
	}

	private write(): void {
		mkdirSync(dirname(this.recordPath), { recursive: true });
		const temp = `${this.recordPath}.${process.pid}`;
		const sessions = [...this.held.values()].map((h) => h.record);
		writeFileSync(temp, `${JSON.stringify({ version: 1, sessions }, null, 2)}\n`);
		renameSync(temp, this.recordPath);
	}
}
