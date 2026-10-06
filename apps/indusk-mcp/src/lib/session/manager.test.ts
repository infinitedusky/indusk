import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionBusy, SessionManager } from "./manager.js";
import type { Session, SessionOptions } from "./start.js";

/**
 * promise: a-session-can-be-stopped — admin-plan-authoring A21, the manager's half.
 *
 * The admin daemon owns its sessions (ADR D2): one at a time, each written to
 * a record so a daemon that stops, or starts again after a crash, can end
 * what it started. Stopping a session ends it and writes nothing else — what
 * the session already wrote stays. The session is a fake here; A22 runs real
 * processes.
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fakeStarter() {
	const started: Array<{ opts: SessionOptions; stopped: boolean }> = [];
	let pid = 40_000;
	const start = (opts: SessionOptions): Session => {
		const entry = { opts, stopped: false };
		started.push(entry);
		let finish: (code: number | null) => void = () => {};
		const done = new Promise<number | null>((r) => {
			finish = r;
		});
		return {
			pid: ++pid,
			kind: opts.kind,
			cwd: opts.cwd,
			say: () => {},
			answer: () => {},
			decide: () => {},
			async stop() {
				entry.stopped = true;
				finish(0);
			},
			done,
		};
	};
	return { started, start };
}

function manager() {
	const dir = mkdtempSync(join(tmpdir(), "session-manager-"));
	dirs.push(dir);
	const record = join(dir, "admin-sessions.json");
	const fake = fakeStarter();
	return { record, fake, m: new SessionManager({ recordPath: record, start: fake.start }) };
}

const planning = {
	cwd: "/p/proj-worktrees/seats",
	kind: "planning" as const,
	prompt: "/planner feature seats",
	onEvent: () => {},
};
const meta = { project: "proj", plan: "seats" };

describe("A21 — a session can be stopped, and only one runs at a time", () => {
	it("a started session is recorded with its pid, project, plan and kind", () => {
		const { m, record } = manager();
		const { id, session } = m.start({ ...planning, ...meta });
		const saved = JSON.parse(readFileSync(record, "utf-8"));
		expect(saved.sessions).toEqual([
			expect.objectContaining({
				id,
				pid: session.pid,
				project: "proj",
				plan: "seats",
				kind: "planning",
			}),
		]);
	});

	it("a second session is refused while one runs, naming the first", () => {
		const { m } = manager();
		const { id } = m.start({ ...planning, ...meta });
		expect(() => m.start({ ...planning, ...meta, plan: "other" })).toThrow(SessionBusy);
		expect(() => m.start({ ...planning, ...meta, plan: "other" })).toThrow(
			new RegExp(`${id}.*seats|seats.*${id}`),
		);
	});

	it("stopping it ends the session and clears the record; another may start", async () => {
		const { m, record, fake } = manager();
		const { id } = m.start({ ...planning, ...meta });
		await m.stop(id);
		expect(fake.started[0].stopped).toBe(true);
		expect(JSON.parse(readFileSync(record, "utf-8")).sessions).toEqual([]);
		expect(() => m.start({ ...planning, ...meta })).not.toThrow();
	});

	it("a session that ends on its own leaves the record", async () => {
		const { m, record } = manager();
		const { session } = m.start({ ...planning, ...meta });
		await session.stop();
		await new Promise((r) => setImmediate(r));
		expect(JSON.parse(readFileSync(record, "utf-8")).sessions).toEqual([]);
	});

	it("stopAll ends every session it holds", async () => {
		const { m, fake } = manager();
		m.start({ ...planning, ...meta });
		await m.stopAll();
		expect(fake.started.every((s) => s.stopped)).toBe(true);
	});

	it("stopping an id it does not hold is refused, naming the id", async () => {
		const { m } = manager();
		await expect(m.stop("nope")).rejects.toThrow(/nope/);
	});
});
