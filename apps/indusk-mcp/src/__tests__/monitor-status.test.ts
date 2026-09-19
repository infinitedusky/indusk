import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLI_BIN, runCli, SHOULD_SKIP } from "./helpers/cli.js";
import {
	type FakeQueryPort,
	type LocalJaeger,
	newTraceId,
	startFakeQueryPort,
	startLocalJaeger,
} from "./helpers/local-jaeger.js";
import {
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * day-monitor — A1, A7–A10: `indusk promises status` over a real local Jaeger.
 *
 * The daemon is the extension's own, started in a home this file owns, and
 * the CLI finds it through `$INDUSK_HOME/telemetry.json` as it does on a
 * developer's machine. Fixture spans carry the ADR D1 mark across two
 * services.
 *
 * The output contract these rows fix: one block per promise, opening on a
 * line that starts with the promise's name, blocks separated by a blank line.
 *
 * Red today: `promises status` is not a command (commander exits 1 with
 * "unknown command"). Green after Build Phase 2.
 */

const DOUBLE = "seat-never-double-booked";
const RELEASE = "seat-release-on-timeout";
const UNSEEN = "seat-hold-expires";
const STATE = "seat-count-matches-table";
const STRUCTURE = "one-archive-writer";

/** The block for `name`: from the line that starts with it to the next blank line. */
function block(out: string, name: string): string {
	const lines = out.split("\n");
	const start = lines.findIndex((l) => l.trimStart().startsWith(name));
	if (start === -1) return "";
	const end = lines.findIndex((l, i) => i > start && l.trim() === "");
	return lines.slice(start, end === -1 ? undefined : end).join("\n");
}

function project(): PromiseProject {
	const behaviour = (name: string) => ({
		name,
		kind: "behaviour" as const,
		state: "enforced" as const,
		domain: "seating",
		owner: "lab-v0",
		sites: [`src/${name}.ts`],
		tests: [`src/${name}.test.ts`],
	});
	return promiseProject({
		domains: ["seating", "archive"],
		archivedPlans: ["lab-v0"],
		promises: [
			behaviour(DOUBLE),
			behaviour(RELEASE),
			behaviour(UNSEEN),
			{
				name: STATE,
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: "lab-v0",
				statement: "A table's seat count equals the seats stored for it.",
				sites: ["src/table.ts"],
				tests: ["src/table.test.ts"],
			},
			{
				name: STRUCTURE,
				kind: "structure",
				state: "enforced",
				domain: "archive",
				owner: "lab-v0",
				statement: "Exactly one module writes the archive.",
				tests: ["src/archive-writer.test.ts"],
			},
		],
		files: {
			...Object.fromEntries(
				[DOUBLE, RELEASE, UNSEEN].flatMap((n) => [
					[`src/${n}.ts`, siteFile(n)],
					[`src/${n}.test.ts`, testFile(n)],
				]),
			),
			"src/table.ts": siteFile(STATE),
			"src/table.test.ts": testFile(STATE),
			"src/archive-writer.test.ts": testFile(STRUCTURE),
		},
	});
}

describe.skipIf(SHOULD_SKIP)("day-monitor — promises status", () => {
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	let out = "";
	let code = -1;
	const violated = [newTraceId(), newTraceId()];
	const upheldDouble = newTraceId();
	const upheldRelease = newTraceId();
	const otherProject = newTraceId();

	beforeAll(async () => {
		fixture = project();
		jaeger = await startLocalJaeger();
		const now = Date.now();
		await jaeger.load([
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: DOUBLE,
				outcome: "violated",
				symptom: "seat 4 held by two players",
				traceId: violated[0],
				at: new Date(now - 3 * 3_600_000),
			},
			{
				service: "fixture-worker",
				name: "hold-seat",
				promise: DOUBLE,
				outcome: "violated",
				symptom: "seat 7 held by two players",
				traceId: violated[1],
				at: new Date(now - 3_600_000),
			},
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: DOUBLE,
				outcome: "upheld",
				traceId: upheldDouble,
				at: new Date(now - 2 * 3_600_000),
			},
			{
				service: "fixture-app",
				name: "release-seat",
				promise: RELEASE,
				outcome: "upheld",
				traceId: upheldRelease,
				at: new Date(now - 600_000),
			},
			// An unmarked span: must not register as any promise.
			{ service: "fixture-app", name: "render-lobby" },
			// Another project's mark of the same promise name (one evaluator
			// service marks for every project on a machine): not this project's.
			{
				service: "fixture-app",
				name: "hold-seat",
				promise: DOUBLE,
				outcome: "violated",
				symptom: "another project's seat",
				traceId: otherProject,
				attributes: { "indusk.project": "some-other-project" },
			},
		]);
		const r = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: jaeger.home });
		out = r.stdout + r.stderr;
		code = r.code;
	}, 90_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("exits 0 when Jaeger answered", () => {
		expect(out).not.toMatch(/unknown command/);
		expect(code).toBe(0);
	});

	it("A1 — a span marked with a promise is found under that promise's name", () => {
		const b = block(out, RELEASE);
		expect(b, `a block for ${RELEASE}`).not.toBe("");
		expect(b).toContain(upheldRelease);
	});

	it("A7 — a behaviour promise lists its violations in the window, their traces, and last seen upheld", () => {
		const b = block(out, DOUBLE);
		expect(b).toMatch(/\b2 violations\b/);
		for (const id of violated) expect(b).toContain(id);
		expect(b, "another project's mark is not counted").not.toContain(otherProject);
		expect(b).toMatch(/last seen upheld/i);
		expect(b).toContain(upheldDouble);
	});

	it('A8 — a behaviour promise with no marked span reads "not seen", never upheld or zero violations', () => {
		const b = block(out, UNSEEN);
		expect(b, `a block for ${UNSEEN}`).not.toBe("");
		expect(b).toMatch(/not seen/i);
		expect(b).not.toMatch(/upheld/i);
		expect(b).not.toMatch(/\b0 violations\b/);
	});

	it("A9 — state and structure promises are watched by the suite and given no violation count", () => {
		for (const name of [STATE, STRUCTURE]) {
			const b = block(out, name);
			expect(b, `a block for ${name}`).not.toBe("");
			expect(b).toMatch(/watched by the suite/i);
			expect(b).not.toMatch(/violation/i);
		}
	});
});

describe.skipIf(SHOULD_SKIP)("day-monitor — promises status without Jaeger", () => {
	let fixture: PromiseProject;
	let home: string;

	beforeAll(() => {
		fixture = project();
		home = mkdtempSync(join(tmpdir(), "indusk-no-jaeger-home-"));
	});

	afterAll(() => {
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		if (home) rmSync(home, { recursive: true, force: true });
	});

	it("A10 — names where it looked and exits 2; never prints zero violations", () => {
		const r = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: home });
		const text = r.stdout + r.stderr;
		expect(text).not.toMatch(/unknown command/);
		expect(r.code).toBe(2);
		expect(text).toContain(join(home, "telemetry.json"));
		expect(text).not.toMatch(/\b0 violations\b/);
		expect(text).not.toMatch(/upheld/i);
	});
});

/**
 * Build Phase 7 — falsification. A27: a mark under a promise's alias. A30: a
 * query that fills the trace limit. A26 (CLI half): a query port that answers
 * with something that is not Jaeger's JSON.
 */
describe.skipIf(SHOULD_SKIP)("day-monitor — status falsification (Build Phase 7)", () => {
	const RENAMED = "seat-hold-released";
	const OLD_NAME = "seat-hold-freed";
	const FLOOD = "seat-flood";
	let jaeger: LocalJaeger;
	let fixture: PromiseProject;
	let out = "";
	const aliased = newTraceId();

	beforeAll(async () => {
		const behaviour = (name: string, aliases?: string[]) => ({
			name,
			kind: "behaviour" as const,
			state: "enforced" as const,
			domain: "seating",
			owner: "lab-v0",
			sites: [`src/${name}.ts`],
			tests: [`src/${name}.test.ts`],
			...(aliases ? { aliases } : {}),
		});
		fixture = promiseProject({
			domains: ["seating"],
			archivedPlans: ["lab-v0"],
			promises: [behaviour(RENAMED, [OLD_NAME]), behaviour(FLOOD)],
			files: Object.fromEntries(
				[RENAMED, FLOOD].flatMap((n) => [
					[`src/${n}.ts`, siteFile(n)],
					[`src/${n}.test.ts`, testFile(n)],
				]),
			),
		});
		jaeger = await startLocalJaeger();
		await jaeger.load([
			{
				service: "fixture-app",
				name: "release-hold",
				promise: OLD_NAME,
				outcome: "violated",
				symptom: "hold never released",
				traceId: aliased,
			},
		]);
		// The query limit is 1500 traces per service and promise.
		await jaeger.load(
			Array.from({ length: 1500 }, () => ({
				service: "fixture-flood",
				name: "hold-seat",
				promise: FLOOD,
				outcome: "violated" as const,
				symptom: "flooded",
			})),
			{ waitFor: "last" },
		);
		const r = runCli(fixture.root, ["promises", "status"], { INDUSK_HOME: jaeger.home });
		out = r.stdout + r.stderr;
	}, 180_000);

	afterAll(() => {
		jaeger?.stop();
		if (jaeger) rmSync(jaeger.home, { recursive: true, force: true });
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("A27 — a span marked with a promise's alias is counted under the promise", () => {
		const b = block(out, RENAMED);
		expect(b).toMatch(/\b1 violation\b/);
		expect(b).toContain(aliased);
	});

	it("A30 — a query that fills the limit is reported as a lower bound", () => {
		const b = block(out, FLOOD);
		expect(b).toMatch(/at least 1500 violations/);
	});
});

describe.skipIf(SHOULD_SKIP)("day-monitor — A26: a query port that is not Jaeger", () => {
	let fixture: PromiseProject;
	let home: string;
	let fake: FakeQueryPort;
	let port = 0;

	beforeAll(async () => {
		fixture = project();
		home = mkdtempSync(join(tmpdir(), "indusk-bad-jaeger-home-"));
		fake = await startFakeQueryPort(home);
		port = fake.port;
	});

	afterAll(async () => {
		await fake?.close();
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
		if (home) rmSync(home, { recursive: true, force: true });
	});

	it("A26 — status exits 2 naming the URL, with no stack trace", async () => {
		// Async: the stub answers from this process, which spawnSync would block.
		const { execFile } = await import("node:child_process");
		const r = await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
			execFile(
				process.execPath,
				[CLI_BIN, "promises", "status"],
				{
					cwd: fixture.root,
					env: { ...process.env, INDUSK_HOME: home, INDUSK_SKIP_UPDATE_CHECK: "1" },
				},
				(err, stdout, stderr) =>
					resolve({
						code: err ? ((err as { code?: number }).code ?? 1) : 0,
						stdout,
						stderr,
					}),
			);
		});
		const text = r.stdout + r.stderr;
		expect(r.code, text).toBe(2);
		expect(text).toContain(`http://localhost:${port}`);
		expect(text).not.toMatch(/^\s+at /m);
		expect(text).not.toMatch(/\b0 violations\b/);
	});
});
