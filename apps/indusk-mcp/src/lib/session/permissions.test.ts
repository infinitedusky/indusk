import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "./manager.js";
import type { PermissionEvent, SessionEvent } from "./protocol.js";
import type { Session, SessionOptions } from "./start.js";

/**
 * brief-as-the-contract A26 — a planning session asks nothing for a write
 * inside its own folder, and a write outside it reaches the person.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 *
 * The session is a fake; the manager is what routes a planning session's
 * permission requests, so the row is asserted through it: what it decides
 * itself (`decide`) and what it hands on to the person (`onEvent`).
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const folder = "/home/.indusk/projects/p-1/drafts/d1";
const extra = "/p/proj-code-worktrees/seats";

function run(addDirs?: string[]) {
	const decided: Array<{ ev: PermissionEvent; decision: unknown }> = [];
	const forwarded: SessionEvent[] = [];
	let emit: (ev: SessionEvent) => void = () => {};
	const start = (opts: SessionOptions): Session => {
		emit = (ev) => opts.onEvent(ev);
		return {
			pid: 1,
			kind: opts.kind,
			cwd: opts.cwd,
			say: () => {},
			answer: () => {},
			decide: (ev, decision) => {
				decided.push({ ev, decision });
			},
			stop: vi.fn(async () => {}),
			done: new Promise(() => {}),
		};
	};
	const recordDir = mkdtempSync(join(tmpdir(), "planning-permissions-"));
	dirs.push(recordDir);
	const m = new SessionManager({ recordPath: join(recordDir, "admin-sessions.json"), start });
	m.start({
		cwd: folder,
		kind: "planning",
		prompt: "talk",
		onEvent: (ev) => {
			if ("type" in ev && ev.type === "permission") forwarded.push(ev);
		},
		project: "proj",
		plan: "draft:d1",
		...(addDirs ? { addDirs } : {}),
	});
	const ask = (input: Record<string, unknown>, tool = "Write") =>
		emit({ type: "permission", requestId: `r${decided.length}${forwarded.length}`, tool, input });
	return { decided, forwarded, ask };
}

describe("A26 — a planning session is asked only about a write outside its folder", () => {
	it("a path inside the session's folder, or a tool given no path, is allowed unasked", () => {
		const { decided, forwarded, ask } = run();
		ask({ file_path: `${folder}/brief.md` });
		ask({ file_path: "proposal.json" });
		ask({ command: "ls" }, "Bash");
		expect(decided.map((d) => d.decision)).toEqual([{ allow: true }, { allow: true }, { allow: true }]);
		expect(forwarded).toEqual([]);
	});

	it("a path in a directory the session was given (addDirs) is inside too", () => {
		const { decided, ask } = run([extra]);
		ask({ file_path: `${extra}/src/seat.ts` });
		expect(decided.map((d) => d.decision)).toEqual([{ allow: true }]);
	});

	it("a path outside is forwarded to the person, not refused and not allowed", () => {
		const { decided, forwarded, ask } = run();
		ask({ file_path: "/Users/dev/code/proj/src/seat.ts" });
		ask({ file_path: `${folder}/../other/x.md` });
		expect(decided).toEqual([]);
		expect(forwarded).toHaveLength(2);
	});
});
