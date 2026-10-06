import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GATE_POLICY_FOR_BUILDS } from "../lib/build/build-session.js";
import { decideBuildPermission } from "../lib/session/permissions.js";
import { type StartedEvent, startSession } from "../lib/session/start.js";
import { runCli } from "./helpers/cli.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: gates-ran-at-every-checkoff — admin-plan-authoring A24, a contract.
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

async function onceToCheckOff(p: { dir: string; impl: string }): Promise<StartedEvent[]> {
	const events: StartedEvent[] = [];
	const holder: { s?: ReturnType<typeof startSession> } = {};
	const s = startSession({
		cwd: p.dir,
		kind: "build",
		model: "sonnet",
		env: GATE_POLICY_FOR_BUILDS,
		prompt:
			"Use the Edit tool once on .indusk/planning/seats/impl.md: replace the line `- [ ] build holds` with `- [x] build holds`. Make no other change. If the edit is refused, say REFUSED and stop; do not try another way.",
		onEvent: (ev) => {
			events.push(ev);
			if (ev.type === "permission") holder.s?.decide(ev, decideBuildPermission(ev, p.dir));
			if (ev.type === "result") void holder.s?.stop(2000);
		},
	});
	holder.s = s;
	await s.done;
	return events;
}

const rateLimited = (events: StartedEvent[]) =>
	events.some((e) => e.type === "result" && /rate.?limit|\b429\b/i.test(e.text));

/** Ask, trying again after a wait when the API is rate limiting — a refusal must come from the gates, never from a session that never ran. */
async function askToCheckOff(p: { dir: string; impl: string }): Promise<StartedEvent[]> {
	for (let attempt = 0; ; attempt++) {
		const events = await onceToCheckOff(p);
		if (!rateLimited(events)) return events;
		if (attempt === 2) throw new Error("rate limited three times; the gates were never reached");
		await new Promise((r) => setTimeout(r, 20_000));
	}
}

const triedToEdit = (events: StartedEvent[]) =>
	events.some((e) => e.type === "tool" && e.name === "Edit");

describe.skipIf(!HAS_CLAUDE)("A24 — a build session is judged by the project's gates", () => {
	it("a skip with its reason lets the next phase's checkoff land", async () => {
		const p = project("(none needed — seats have no public page yet)");
		const events = await askToCheckOff(p);
		expect(triedToEdit(events), JSON.stringify(events.slice(-3))).toBe(true);
		expect(readFileSync(p.impl, "utf-8")).toContain("- [x] build holds");
	}, 300_000);

	it("a bare (none needed) is refused by check-gates, and the file is unchanged", async () => {
		const p = project("(none needed)");
		const before = readFileSync(p.impl, "utf-8");
		const events = await askToCheckOff(p);
		expect(triedToEdit(events), JSON.stringify(events.slice(-3))).toBe(true);
		expect(readFileSync(p.impl, "utf-8")).toBe(before);
	}, 300_000);
});
