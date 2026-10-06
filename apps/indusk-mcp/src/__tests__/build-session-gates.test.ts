import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GATE_POLICY_FOR_BUILDS } from "../lib/build/build-session.js";
import { decideBuildPermission, refuseBuildQuestion } from "../lib/session/permissions.js";
import {
	isRateLimitedResult,
	RATE_LIMIT_RETRIES,
	rateLimitDelayMs,
} from "../lib/session/rate-limit.js";
import { type StartedEvent, startSession } from "../lib/session/start.js";
import { runCli } from "./helpers/cli.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: gates-ran-at-every-checkoff — admin-plan-authoring A24, a contract; publish-hygiene A4.
 *
 * A build session the admin starts is still judged by the project's gates.
 * In a project `indusk init` set up, a real `claude` build session — run
 * exactly as a build runs one, under `INDUSK_GATE_POLICY=auto` — is asked to
 * check off the next phase's first item. When the earlier phase skipped a
 * gate item with its reason the checkoff lands; with a bare `(none needed)`,
 * `check-gates.js` refuses it and the file is unchanged. System tier: it
 * starts real sessions on the developer's login.
 */

const HAS_CLAUDE = spawnSync("claude", ["--version"], { encoding: "utf-8" }).status === 0;
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project(skip: string): { dir: string; impl: string } {
	const base = realpathSync(mkdtempSync(join(tmpdir(), "build-gates-")));
	dirs.push(base);
	const home = join(base, "home");
	mkdirSync(home);
	const dir = join(base, "proj");
	mkdirSync(dir);
	writeFileSync(join(dir, "package.json"), '{"name":"proj","version":"0.0.0"}\n');
	git(dir, ["init", "-q", "-b", "main"]);
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-qm", "init"]);
	const r = runCli(dir, ["init", "--local", "--no-index"], {
		INDUSK_HOME: home,
		INDUSK_SKIP_SELF_UPDATE: "1",
		INDUSK_SKIP_TELEMETRY_AUTOSTART: "1",
	});
	if (r.code !== 0) throw new Error(`init failed: ${r.stderr}`);
	const impl = join(dir, ".indusk", "planning", "seats", "impl.md");
	mkdirSync(join(dir, ".indusk", "planning", "seats"), { recursive: true });
	writeFileSync(
		impl,
		[
			"---",
			"title: seats",
			"status: in-progress",
			"gate_policy: ask",
			"---",
			"",
			"## Checklist",
			"",
			"### Build Phase 1: Seats",
			"",
			"- [x] build seats",
			"",
			"#### Build Phase 1 Verification",
			"",
			"- [x] the tests pass",
			"",
			"#### Build Phase 1 Context",
			"",
			"- [x] the area's CLAUDE.md",
			"",
			"#### Build Phase 1 Document",
			"",
			`- [ ] ${skip}`,
			"",
			"### Build Phase 2: Holds",
			"",
			"- [ ] build holds",
			"",
			"#### Build Phase 2 Verification",
			"",
			"- [ ] the tests pass",
			"",
		].join("\n"),
	);
	return { dir, impl };
}

/** How long one session may run before it is stopped as hung (publish-hygiene A4). */
const SESSION_DEADLINE_MS = 120_000;

type Attempt = { events: StartedEvent[]; hung: boolean };

/**
 * One session, answered exactly as a build answers it (`build-session.ts`):
 * a permission by `decideBuildPermission`, a question declined with
 * `refuseBuildQuestion`'s message, so it never waits on a person who is not
 * there. A session still running after the deadline is stopped and reported
 * as hung — the landing run of 2026-10-06 waited 300 s on one.
 */
async function onceToCheckOff(p: { dir: string; impl: string }): Promise<Attempt> {
	const events: StartedEvent[] = [];
	const holder: { s?: ReturnType<typeof startSession> } = {};
	const s = startSession({
		cwd: p.dir,
		kind: "build",
		model: "sonnet",
		env: GATE_POLICY_FOR_BUILDS,
		prompt:
			"This project is a test fixture for InDusk's gate hooks; its plan describes no real work, and the test asks whether the hooks let one checkoff through. Read .indusk/planning/seats/impl.md, then use the Edit tool once on it: replace the line `- [ ] build holds` with `- [x] build holds`. Make no other change. If a hook refuses the edit, say REFUSED and stop; do not try another way.",
		onEvent: (ev) => {
			events.push(ev);
			if (ev.type === "permission") holder.s?.decide(ev, decideBuildPermission(ev, p.dir));
			if (ev.type === "question") {
				const refusal = refuseBuildQuestion(ev);
				holder.s?.decide(
					{ type: "permission", requestId: ev.requestId, tool: "AskUserQuestion", input: ev.input },
					{ allow: false, message: refusal.allow ? "" : refusal.message },
				);
			}
			if (ev.type === "result") void holder.s?.stop(2000);
		},
	});
	holder.s = s;
	let hung = false;
	const deadline = setTimeout(() => {
		hung = true;
		void s.stop(2000);
	}, SESSION_DEADLINE_MS);
	await s.done;
	clearTimeout(deadline);
	return { events, hung };
}

const rateLimited = (events: StartedEvent[]) =>
	events.some((e) => e.type === "result" && isRateLimitedResult(e));

/**
 * Ask, trying again when the API rate-limited the session (the shared rule
 * and schedule) or when it hung before trying the edit (once) — a refusal
 * must come from the gates, never from a session that never ran. Returns
 * every attempt's events.
 */
async function askToCheckOff(p: { dir: string; impl: string }): Promise<StartedEvent[]> {
	let hangs = 0;
	const all: StartedEvent[] = [];
	for (let limits = 0; ; ) {
		const { events, hung } = await onceToCheckOff(p);
		all.push(...events);
		const last = JSON.stringify(events.slice(-3));
		// Once an edit was tried, the gates have judged it; a session that then
		// overran the deadline changes nothing, and a retry would find the
		// line already checked.
		if (triedToEdit(events)) return all;
		if (hung) {
			if (++hangs > 1)
				throw new Error(`the session hung twice, past ${SESSION_DEADLINE_MS} ms: ${last}`);
			continue;
		}
		if (!rateLimited(events)) return all;
		if (++limits > RATE_LIMIT_RETRIES)
			throw new Error(`rate limited ${limits} times; the gates were never reached: ${last}`);
		await new Promise((r) => setTimeout(r, rateLimitDelayMs(limits, 10_000)));
	}
}

const triedToEdit = (events: StartedEvent[]) =>
	events.some((e) => e.type === "tool" && e.name === "Edit");

describe.skipIf(!HAS_CLAUDE)("A24 — a build session is judged by the project's gates", () => {
	it("a skip with its reason lets the next phase's checkoff land", async () => {
		const p = project("(none needed — seats have no public page yet)");
		const events = await askToCheckOff(p);
		expect(triedToEdit(events), JSON.stringify(events.slice(-3))).toBe(true);
		expect(
			readFileSync(p.impl, "utf-8"),
			`the edit was tried and the file did not change: ${JSON.stringify(events.slice(-4))}`,
		).toContain("- [x] build holds");
	}, 300_000);

	it("a bare (none needed) is refused by check-gates, and the file is unchanged", async () => {
		const p = project("(none needed)");
		const before = readFileSync(p.impl, "utf-8");
		const events = await askToCheckOff(p);
		expect(triedToEdit(events), JSON.stringify(events.slice(-3))).toBe(true);
		expect(readFileSync(p.impl, "utf-8")).toBe(before);
	}, 300_000);
});
