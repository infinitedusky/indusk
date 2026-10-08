import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gitOut } from "../../__tests__/helpers/cli.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import {
	behaviourPromise,
	codeFilesFor,
	type PromiseProject,
	promiseProject,
	writePromise,
} from "../../__tests__/helpers/promises-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { makeVersionedWorkbench } from "../../__tests__/helpers/versioned-workbench.js";
import { JaegerUnreachable, WatcherBlind } from "./sources.js";
import type { MarkedSpan, MarkedSpansResult } from "./telemetry.js";

/**
 * incident-recording A1–A4, A26 — promise: a-production-break-is-recorded-unasked;
 * A23 — promise: the-demo-break-is-caught-locally;
 * A26 — promise: a-project-has-one-contract.
 *
 * The one writer behind the admin's loop, catchup and `watch`: a pass records
 * a new production violation as an incident and reopens its owner, never
 * twice (A1); commits what it wrote, by path, in the repository that holds
 * each file, and leaves an owner being worked in a plan worktree to that
 * worktree (A2); marks itself — broken with the reason when it could not read
 * or could not write, held otherwise (A3); makes one incident when two
 * callers run at once (A4); refuses to record `production` for a project
 * that names none (A23); and, in a workbench, writes where the contract
 * resolver says (A26).
 *
 * Its reads and its mark are inputs, so a violation reaches it without a
 * Jaeger. Loaded by dynamic import: the module is Build Phase 1's, and a
 * static import of it would fail this file at load rather than each test on
 * its assertion.
 */

const PROMISE = "seat-released";
const OWNER = "seat-holds";
const TRACE = "4bf92f3577b34da6a3ce929d0e0e4736";
const JAEGER = { url: "https://jaeger.example", credential_env: "IR_TEST_JAEGER" };

type PassMark = { outcome: "upheld" | "violated"; symptom?: string };
type Change = { id: string; promise: string; owner: string };
interface RecordResult {
	opened: Change[];
	extended: Change[];
	committed: string[];
	mark?: PassMark;
	refused?: string;
}
type RecordBreaks = (
	planRoot: string,
	opts: { by: "admin" | "catchup" | "watch"; source: "deployed" | "local"; now?: Date },
	deps: {
		reads: (...args: unknown[]) => Promise<MarkedSpansResult>;
		mark: (m: PassMark) => void;
		home: string;
	},
) => Promise<RecordResult>;

async function recordBreaks(): Promise<RecordBreaks> {
	const mod = (await import("./record.js")) as Record<string, unknown>;
	if (typeof mod.recordBreaks !== "function") throw new Error("record.ts exports no recordBreaks");
	return mod.recordBreaks as RecordBreaks;
}

const violation = (trace: string): MarkedSpan =>
	({
		promise: PROMISE,
		outcome: "violated",
		traceId: trace,
		spanId: "00f067aa0ba902b7",
		service: "seat-holds",
		operation: "release",
		at: new Date("2026-10-08T20:00:00Z"),
		symptom: "a held seat was not released",
		environment: "production",
	}) as MarkedSpan;

/** A production read that answers `traces` as violations of PROMISE, after yielding once. */
const answering = (traces: string[]) => async (): Promise<MarkedSpansResult> => {
	await new Promise((r) => setImmediate(r));
	return {
		queryUrl: JAEGER.url,
		since: new Date("2026-10-01T00:00:00Z"),
		byPromise: new Map([
			[PROMISE, { violations: traces.map(violation), truncated: false, lastUpheld: null }],
		]),
	};
};

const failing = (err: Error) => async (): Promise<MarkedSpansResult> => {
	throw err;
};

let home: string;
let marks: PassMark[];
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "record-home-"));
	marks = [];
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	// Last registered first: a permission restored before its project is removed.
	for (const c of cleanups.splice(0).reverse()) c();
});

const deps = (reads: () => Promise<MarkedSpansResult>) => ({
	reads,
	mark: (m: PassMark) => marks.push(m),
	home,
});

/** An archived owner (on the trunk) and a production source. */
function project(jaeger: object | null = JAEGER): PromiseProject {
	const fx = promiseProject({
		archivedPlans: [OWNER],
		planFiles: {
			[`archive/${OWNER}/impl.md`]: `---\ntitle: "${OWNER}"\nstatus: completed\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Build Phase 1: Build\n\n- [x] built\n`,
		},
		promises: [behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" })],
		files: codeFilesFor(PROMISE),
		extraConfig: {
			promises: { domains: ["seating"], ...(jaeger ? { jaeger } : {}) },
		},
	});
	cleanups.push(() => rmSync(fx.root, { recursive: true, force: true }));
	return fx;
}

const incidentsIn = (root: string): string[] => {
	const dir = join(root, ".indusk", "promises", "incidents");
	return existsSync(dir) ? readdirSync(dir) : [];
};
const ownerImpl = (root: string) =>
	readFileSync(join(root, ".indusk", "planning", "archive", OWNER, "impl.md"), "utf-8");

describe("A1 — a pass records a new production violation once", () => {
	it("leaves an incident naming the trace and a Maintenance phase; a second pass changes nothing", async () => {
		const record = await recordBreaks();
		const fx = project();
		const first = await record(
			fx.root,
			{ by: "admin", source: "deployed" },
			deps(answering([TRACE])),
		);
		expect(first.opened).toEqual([expect.objectContaining({ promise: PROMISE, owner: OWNER })]);
		const [file] = incidentsIn(fx.root);
		expect(
			readFileSync(join(fx.root, ".indusk", "promises", "incidents", file), "utf-8"),
		).toContain(TRACE);
		expect(ownerImpl(fx.root)).toMatch(/### Build Phase 2: Maintenance — i-/);

		const head = gitOut(fx.root, ["rev-parse", "HEAD"]);
		const implBefore = ownerImpl(fx.root);
		const second = await record(
			fx.root,
			{ by: "admin", source: "deployed" },
			deps(answering([TRACE])),
		);
		expect(second.opened).toEqual([]);
		expect(second.extended).toEqual([]);
		expect(incidentsIn(fx.root)).toEqual([file]);
		expect(ownerImpl(fx.root)).toBe(implBefore);
		expect(gitOut(fx.root, ["rev-parse", "HEAD"])).toBe(head);
	});
});

describe("A2 — what a pass records is committed, by path, as InDusk's", () => {
	it("commits the incident, the promise and the trunk owner's impl in one commit, leaving the tree clean", async () => {
		const record = await recordBreaks();
		const fx = project();
		const r = await record(fx.root, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		expect(gitOut(fx.root, ["status", "--porcelain"])).toBe("");
		expect(gitOut(fx.root, ["log", "-1", "--format=%s"])).toMatch(
			new RegExp(`^chore\\(indusk\\): incident i-[^ ]+ — ${PROMISE}, recorded by admin`),
		);
		const touched = gitOut(fx.root, ["show", "--name-only", "--format=", "HEAD"]).split("\n");
		expect(touched).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^\.indusk\/promises\/incidents\/i-/),
				`.indusk/promises/${PROMISE}.md`,
				`.indusk/planning/archive/${OWNER}/impl.md`,
			]),
		);
		expect(r.committed.length).toBe(touched.filter(Boolean).length);
	});

	it("leaves an owner being worked in a plan worktree to that worktree, uncommitted", async () => {
		const record = await recordBreaks();
		const p: PlanLifecycleProject = planLifecycleProject("record-worktree");
		cleanups.push(() => p.cleanup());
		const config = JSON.parse(readFileSync(join(p.trunk, ".indusk", "config.json"), "utf-8"));
		config.promises.jaeger = JAEGER;
		p.commit(
			p.trunk,
			{
				".indusk/config.json": `${JSON.stringify(config, null, "\t")}\n`,
				[`.indusk/planning/${OWNER}/impl.md`]: `---\ntitle: "${OWNER}"\nstatus: in-progress\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Build Phase 1: Build\n\n- [ ] build\n`,
				...codeFilesFor(PROMISE),
			},
			"an active owner",
		);
		writePromise(join(p.trunk, ".indusk", "promises"), {
			...behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" }),
		});
		git(p.trunk, ["add", "-A"]);
		git(p.trunk, ["commit", "-qm", "its promise"]);
		const wt = p.makeWorktree(OWNER);

		await record(p.trunk, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		expect(gitOut(p.trunk, ["status", "--porcelain"])).toBe("");
		expect(readFileSync(join(wt, ".indusk", "planning", OWNER, "impl.md"), "utf-8")).toMatch(
			/Maintenance — i-/,
		);
		expect(gitOut(wt, ["status", "--porcelain"])).toContain(`.indusk/planning/${OWNER}/impl.md`);
	});
});

describe("A3 — a pass marks itself", () => {
	it.each([
		[
			"the server could not be reached",
			new JaegerUnreachable(JAEGER.url, "connect ECONNREFUSED"),
			/reach|ECONNREFUSED/i,
		],
		[
			"the watcher is blind",
			new WatcherBlind(JAEGER.url, `${JAEGER.url}/v1/traces`, "probe not read back"),
			/blind/i,
		],
	])("%s: nothing recorded, marked broken with the reason", async (_case, err, reason) => {
		const record = await recordBreaks();
		const fx = project();
		const head = gitOut(fx.root, ["rev-parse", "HEAD"]);
		const r = await record(fx.root, { by: "admin", source: "deployed" }, deps(failing(err)));
		expect(r.opened).toEqual([]);
		expect(incidentsIn(fx.root)).toEqual([]);
		expect(gitOut(fx.root, ["rev-parse", "HEAD"])).toBe(head);
		expect(marks).toEqual([{ outcome: "violated", symptom: expect.stringMatching(reason) }]);
	});

	it("the incident could not be written: nothing committed, marked broken with the reason", async () => {
		const record = await recordBreaks();
		const fx = project();
		const registry = join(fx.root, ".indusk", "promises");
		chmodSync(registry, 0o555);
		cleanups.push(() => chmodSync(registry, 0o755));
		const head = gitOut(fx.root, ["rev-parse", "HEAD"]);
		await record(fx.root, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		expect(gitOut(fx.root, ["rev-parse", "HEAD"])).toBe(head);
		expect(marks).toEqual([
			{ outcome: "violated", symptom: expect.stringMatching(/EACCES|permission/i) },
		]);
	});

	it("a pass that recorded, and one that found nothing, are marked held", async () => {
		const record = await recordBreaks();
		const fx = project();
		await record(fx.root, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		await record(fx.root, { by: "admin", source: "deployed" }, deps(answering([])));
		expect(marks).toEqual([{ outcome: "upheld" }, { outcome: "upheld" }]);
	});
});

describe("A4 — two callers at once make one incident", () => {
	it("a recording pass and a hand `watch` racing over one checkout open one incident", async () => {
		const record = await recordBreaks();
		const fx = project();
		const [a, b] = await Promise.all([
			record(fx.root, { by: "admin", source: "deployed" }, deps(answering([TRACE]))),
			record(fx.root, { by: "watch", source: "deployed" }, deps(answering([TRACE]))),
		]);
		expect([...a.opened, ...b.opened]).toHaveLength(1);
		expect(incidentsIn(fx.root)).toHaveLength(1);
		expect(gitOut(fx.root, ["status", "--porcelain"])).toBe("");
	});
});

describe("A23 — a project naming no production source is never recorded unprompted", () => {
	it("refuses to record `production`, saying why, and writes nothing", async () => {
		const record = await recordBreaks();
		const fx = project(null);
		const head = gitOut(fx.root, ["rev-parse", "HEAD"]);
		const r = await record(fx.root, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		expect(r.refused).toMatch(/promises\.jaeger/);
		expect(incidentsIn(fx.root)).toEqual([]);
		expect(gitOut(fx.root, ["rev-parse", "HEAD"])).toBe(head);
		expect(marks).toEqual([]);
	});
});

describe("A26 — in a workbench the writer writes where the contract resolver says", () => {
	it("records into the repo's own contract and commits it in the repo", async () => {
		const record = await recordBreaks();
		const wb = makeVersionedWorkbench({
			repos: [{ name: "alpha" }],
			layout: "nested",
			shape: "workbench",
		});
		cleanups.push(() => wb.cleanup());
		const repo = wb.repos[0].dir;
		const configPath = join(wb.root, ".indusk", "config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		config.promises = { domains: ["seating"], jaeger: JAEGER };
		const { writeFileSync, mkdirSync } = await import("node:fs");
		writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
		mkdirSync(join(wb.root, ".indusk", "planning", "archive", OWNER), { recursive: true });
		writeFileSync(
			join(wb.root, ".indusk", "planning", "archive", OWNER, "impl.md"),
			`---\ntitle: "${OWNER}"\nstatus: completed\n---\n\n# ${OWNER}\n\n## Checklist\n\n### Build Phase 1: Build\n\n- [x] built\n`,
		);
		git(wb.root, ["add", "-A"]);
		git(wb.root, ["commit", "-qm", "owner"]);
		writePromise(
			join(repo, ".indusk", "promises"),
			behaviourPromise(PROMISE, { owner: OWNER, domain: "seating" }),
		);
		for (const [rel, body] of Object.entries(codeFilesFor(PROMISE))) {
			mkdirSync(join(repo, rel, ".."), { recursive: true });
			writeFileSync(join(repo, rel), body);
		}
		git(repo, ["add", "-A"]);
		git(repo, ["commit", "-qm", "the repo's contract"]);

		await record(wb.root, { by: "admin", source: "deployed" }, deps(answering([TRACE])));
		expect(incidentsIn(repo)).toHaveLength(1);
		expect(incidentsIn(wb.root)).toEqual([]);
		expect(gitOut(repo, ["status", "--porcelain"])).toBe("");
		expect(gitOut(repo, ["log", "-1", "--format=%s"])).toMatch(/^chore\(indusk\): incident i-/);
	});
});
