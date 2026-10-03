import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { type LocalJaeger, newTraceId, startLocalJaeger } from "./helpers/local-jaeger.js";
import {
	behaviourPromise,
	codeFilesFor,
	openIncidentSpec,
	type PromiseProject,
	promiseProject,
} from "./helpers/promises-fixture.js";

/**
 * watch-reopen-collision — A1, A2, A4: a broken promise reaches a plan that
 * owns it, or `indusk promises watch` says loudly that it did not.
 *
 * Found in the numero promise smoke (2026-10-02): an incident file was
 * deleted while its Maintenance phase stayed in the owner; the next violation
 * the same day got the deleted file's id, the reopen saw that phase and said
 * nothing, and `watch` exited 0. Driven through the CLI against a real local
 * Jaeger, as `monitor-watch.test.ts` is — a stubbed source would test the stub.
 */

const OWNER = "smoke-owner";
const REUSED = "chat-keeps-line-breaks"; // A1
const EXTENDED = "seat-release-on-timeout"; // A2
const ORPHAN = "seat-never-double-booked"; // A4
const EXTENDED_ORPHAN = "table-closes-on-empty"; // A5
const LEFT_OPEN = "bet-settles-once"; // A6, owner exists
const LEFT_ORPHAN = "pot-splits-evenly"; // A6, owner is not a plan folder
const today = () => new Date().toISOString().slice(0, 10);

/** An owner's impl: one landed build phase and, optionally, Maintenance phases for the ids given. */
function ownerImpl(maintenanceFor: string[]): string {
	const phases = maintenanceFor
		.map((id, i) => `### Build Phase ${i + 2}: Maintenance — ${id}\n\n- [ ] fix it\n`)
		.join("\n");
	return `---
title: "${OWNER}"
status: in-progress
trajectory: required
---

# ${OWNER}

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | the feature works | Build Phase 1 | Build Phase 1 | passing |

## Checklist

### Build Phase 1: the feature

- [x] built it

${phases}`;
}

function incidentFiles(root: string): string[] {
	try {
		return readdirSync(join(root, ".indusk", "promises", "incidents")).filter((n) =>
			n.endsWith(".md"),
		);
	} catch {
		return [];
	}
}

const ownerText = (p: PromiseProject) =>
	readFileSync(join(p.planRoot, ".indusk", "planning", OWNER, "impl.md"), "utf-8");

describe.skipIf(SHOULD_SKIP)("watch-reopen-collision — promises watch", () => {
	let jaeger: LocalJaeger;
	const projects: PromiseProject[] = [];

	beforeAll(async () => {
		jaeger = await startLocalJaeger();
		await jaeger.load([
			{
				service: "fixture-app",
				name: "send-message",
				promise: REUSED,
				outcome: "violated",
				symptom: "a blank line was lost",
				traceId: newTraceId(),
			},
			{
				service: "fixture-app",
				name: "release-seat",
				promise: EXTENDED,
				outcome: "violated",
				symptom: "seat 9 never released",
				traceId: newTraceId(),
			},
			{
				service: "fixture-app",
				name: "close-table",
				promise: EXTENDED_ORPHAN,
				outcome: "violated",
				symptom: "an empty table stayed open",
				traceId: newTraceId(),
			},
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: ORPHAN,
				outcome: "violated",
				symptom: "seat 4 held twice",
				traceId: newTraceId(),
			},
		]);
	}, 90_000);

	afterAll(() => {
		jaeger?.stop();
		for (const dir of [jaeger?.home, ...projects.map((p) => p.root)]) {
			if (dir) rmSync(dir, { recursive: true, force: true });
		}
	});

	const watch = (p: PromiseProject) => {
		const r = runCli(p.root, ["promises", "watch"], { INDUSK_HOME: jaeger.home });
		return { code: r.code, out: r.stdout, err: r.stderr };
	};

	it("A1 — a deleted incident's id is not reused: the new incident gets `-2` and the owner gains its phase", () => {
		const stale = `i-${today()}-${REUSED}`;
		const p = promiseProject({
			domains: ["chat"],
			activePlans: [OWNER],
			// The deleted incident's Maintenance phase stays; its file is gone.
			planFiles: { [`${OWNER}/impl.md`]: ownerImpl([stale]) },
			promises: [behaviourPromise(REUSED, { owner: OWNER, domain: "chat" })],
			files: codeFilesFor(REUSED),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.code, `${r.out}\n${r.err}`).toBe(0);
		expect(incidentFiles(p.root), "the new incident takes the next free id").toEqual([
			`${stale}-2.md`,
		]);
		expect(ownerText(p), "the owner is reopened for the new incident").toContain(
			`Maintenance — ${stale}-2`,
		);
	});

	it("A2 — a violation of a promise with an open incident extends it, quietly, with one phase", () => {
		const open = `i-2026-09-17-${EXTENDED}`;
		const p = promiseProject({
			domains: ["chat"],
			activePlans: [OWNER],
			planFiles: { [`${OWNER}/impl.md`]: ownerImpl([open]) },
			promises: [
				behaviourPromise(EXTENDED, {
					owner: OWNER,
					domain: "chat",
					state: "known-violated",
					incidents: [open],
				}),
			],
			incidents: [openIncidentSpec(open, EXTENDED)],
			files: codeFilesFor(EXTENDED),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.code, `${r.out}\n${r.err}`).toBe(0);
		expect(r.out, "it was extended").toMatch(new RegExp(`extended ${open}`));
		expect(r.err, "an extended incident reports nothing as failed").toBe("");
		expect(ownerText(p).split(`Maintenance — ${open}`).length - 1, "one phase, not two").toBe(1);
	});

	it("A4 — an opened incident whose owner is not a plan folder makes watch exit non-zero", () => {
		const p = promiseProject({
			domains: ["chat"],
			promises: [behaviourPromise(ORPHAN, { owner: "no-such-plan", domain: "chat" })],
			files: codeFilesFor(ORPHAN),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.err, "the reopen that did not happen is said").toMatch(/no-such-plan/);
		expect(r.code, "and a run that did not reopen an opened incident is not a success").not.toBe(0);
	});

	it("A5 — extending an open incident whose owner is not a plan folder still fails the run", () => {
		const open = `i-2026-09-17-${EXTENDED_ORPHAN}`;
		const p = promiseProject({
			domains: ["chat"],
			promises: [
				behaviourPromise(EXTENDED_ORPHAN, {
					owner: "no-such-plan",
					domain: "chat",
					state: "known-violated",
					incidents: [open],
				}),
			],
			incidents: [openIncidentSpec(open, EXTENDED_ORPHAN)],
			files: codeFilesFor(EXTENDED_ORPHAN),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.out, "the new violation extended the incident").toMatch(
			new RegExp(`extended ${open}`),
		);
		expect(r.err).toMatch(/no-such-plan/);
		expect(r.code, "an extended incident with no owner is as unowned as an opened one").not.toBe(0);
	});

	it("A6 — an open incident left without its owner's phase is reopened on a run with no new violation", () => {
		const open = `i-2026-09-17-${LEFT_OPEN}`;
		const p = promiseProject({
			domains: ["chat"],
			activePlans: [OWNER],
			// An earlier run recorded the incident and could not reopen; the owner carries no phase for it.
			planFiles: { [`${OWNER}/impl.md`]: ownerImpl([]) },
			promises: [
				behaviourPromise(LEFT_OPEN, {
					owner: OWNER,
					domain: "chat",
					state: "known-violated",
					incidents: [open],
				}),
			],
			incidents: [openIncidentSpec(open, LEFT_OPEN)],
			files: codeFilesFor(LEFT_OPEN),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.code, `${r.out}\n${r.err}`).toBe(0);
		expect(ownerText(p), "the owner gains the incident's Maintenance phase").toContain(
			`Maintenance — ${open}`,
		);
	});

	it("A6 — and when the owner still cannot be reopened, that quiet run says so and fails", () => {
		const open = `i-2026-09-17-${LEFT_ORPHAN}`;
		const p = promiseProject({
			domains: ["chat"],
			promises: [
				behaviourPromise(LEFT_ORPHAN, {
					owner: "no-such-plan",
					domain: "chat",
					state: "known-violated",
					incidents: [open],
				}),
			],
			incidents: [openIncidentSpec(open, LEFT_ORPHAN)],
			files: codeFilesFor(LEFT_ORPHAN),
		});
		projects.push(p);
		const r = watch(p);
		expect(r.err, "the unowned incident is named again").toMatch(/no-such-plan/);
		expect(r.code, 'not "No new violations" and exit 0').not.toBe(0);
	});
});
