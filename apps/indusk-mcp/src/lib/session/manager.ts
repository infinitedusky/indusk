import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { SessionKind } from "./protocol.js";
import { type Session, type SessionOptions, type StartedEvent, startSession } from "./start.js";

/**
 * Who owns the sessions the admin starts (admin-plan-authoring, ADR D2): the
 * admin daemon, through one manager. One session at a time; each written to a
 * record (`~/.indusk/admin-sessions.json`) so `indusk ui stop` can end them
 * and a daemon starting after a crash can end what its predecessor left.
 *
 * The manager keeps each session's events so a panel that connects after the
 * session started still sees all of it, then hears the rest as it happens.
 */

export class SessionBusy extends Error {}

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
}

export function defaultRecordPath(): string {
	return join(process.env.INDUSK_HOME ?? join(homedir(), ".indusk"), "admin-sessions.json");
}

export class SessionManager {
	private readonly recordPath: string;
	private readonly launch: (opts: SessionOptions) => Session;
	private readonly held = new Map<string, Held>();

	constructor(opts: { recordPath?: string; start?: (opts: SessionOptions) => Session } = {}) {
		this.recordPath = opts.recordPath ?? defaultRecordPath();
		this.launch = opts.start ?? startSession;
	}

	/** Start a session, refusing while another runs. */
	start(opts: ManagedStart): { id: string; session: Session } {
		const running = [...this.held.values()][0];
		if (running) {
			throw new SessionBusy(
				`a session is already running: ${running.record.id}, ${running.record.kind} for ${running.record.plan} — stop it first`,
			);
		}
		const id = randomUUID();
		const holder: Held = {
			record: undefined as unknown as SessionRecord,
			session: undefined as unknown as Session,
			events: [],
			listeners: new Set(),
		};
		const session = this.launch({
			...opts,
			onEvent: (ev) => {
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

	/** The running session's record, if any. */
	current(): SessionRecord | undefined {
		return [...this.held.values()][0]?.record;
	}

	/** Every event so far, then each new one, until the returned function is called. */
	subscribe(id: string, listen: (ev: StartedEvent) => void): () => void {
		const h = this.held.get(id);
		if (!h) throw new Error(`no session ${id}`);
		for (const ev of h.events) listen(ev);
		h.listeners.add(listen);
		return () => h.listeners.delete(listen);
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
			if (!isAlive(r.pid) || !commandOf(r.pid).includes(r.bin)) continue;
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

function isAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function commandOf(pid: number): string {
	const r = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf-8" });
	return r.status === 0 ? r.stdout.trim() : "";
}
