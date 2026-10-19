// clause: a-clause-is-proved-twice/upheld-by-its-signal
// promise: a-clause-is-proved-twice
// live check: runs only with INDUSK_LIVE_CHECK=clause-signal, against ~/.indusk, once
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clauseStanding } from "../lib/promises/clause-standing.js";
import { localSignalReader } from "../lib/promises/closing-inputs.js";
import { markProjectId } from "../lib/promises/config.js";
import { confirmPlan } from "../lib/promises/confirm.js";
import { readPromises } from "../lib/promises/registry.js";
import {
	CLAUSES,
	clausePlanProject,
	PLAN,
	PROMISE,
	passingRun,
} from "./helpers/clause-plan-fixture.js";
import type { PromiseProject } from "./helpers/promises-fixture.js";

/**
 * A11 of mark-first — a clause's signal, run against the real system through
 * the local daemon, reports upheld, and the clause then reads upheld end to end.
 *
 * The signal is written by a child process with no test runner in its
 * environment: a span written under vitest carries `indusk.run=test` and every
 * reader skips it (mark-first ADR D3), so only a real run counts. The child
 * writes through `commandTracer()` and `markPromise`, the way a real close
 * does; the parent reads it back through the package's own reader
 * (`localSignalReader`, which keeps only this project's signals, so the child
 * signals as the fixture's project), decides it with `clauseStanding`, and closes the
 * fixture plan with `confirmPlan` on that reader.
 *
 * It runs against the real InDusk home, once, and only when asked
 * (`INDUSK_LIVE_CHECK=clause-signal`): the system tier sets a throwaway home,
 * which has no daemon, and a release must not depend on the developer's own
 * daemon. The promise written to is the fixture's `a-promise`, which no real
 * registry holds, so no real promise's standing moves. The daemon is found by
 * its stored address (`daemon-found-not-guessed`), never by a port.
 */

const live = process.env.INDUSK_LIVE_CHECK === "clause-signal";
const PKG = resolve(__dirname, "../..");
const TSX = join(PKG, "node_modules/.bin/tsx");
const REAL_HOME = join(homedir(), ".indusk");

const child = (project: string) => `
import { commandTracer, flushCommandTracer } from "./src/lib/telemetry/command-tracer.ts";
import { markPromise } from "./src/lib/promises/mark.ts";
const tracer = commandTracer();
for (const clause of ${JSON.stringify(CLAUSES.map((c) => c.name))}) {
  const span = tracer.startSpan("promises.confirm");
  markPromise(span, { promise: ${JSON.stringify(PROMISE)}, clause, project: ${JSON.stringify(project)}, outcome: "upheld" });
  span.end();
}
flushCommandTracer().then(() => console.log("sent"));
`;

/** Wait for the daemon to index what the child sent: its ingest is asynchronous. */
async function until<T>(read: () => Promise<T>, done: (v: T) => boolean): Promise<T> {
	let last = await read();
	for (let i = 0; i < 30 && !done(last); i++) {
		await new Promise((r) => setTimeout(r, 1000));
		last = await read();
	}
	return last;
}

describe.skipIf(!live)("A11 — a clause's signal through the real daemon reads upheld", () => {
	let fixture: PromiseProject;
	const previousHome = process.env.INDUSK_HOME;
	const startedAt = Date.now();

	beforeAll(() => {
		process.env.INDUSK_HOME = REAL_HOME;
		fixture = clausePlanProject();
	});
	afterAll(() => {
		if (previousHome === undefined) delete process.env.INDUSK_HOME;
		else process.env.INDUSK_HOME = previousHome;
		if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	});

	it("reaches the daemon from a real run, reads upheld, and closes the plan", async () => {
		// A real run: nothing in the child's environment says a test runner is up.
		const env = { ...process.env, INDUSK_HOME: REAL_HOME };
		for (const key of Object.keys(env)) if (key.startsWith("VITEST")) delete env[key];
		delete env.NODE_ENV;
		const run = spawnSync(TSX, ["-e", child(markProjectId(fixture.planRoot))], {
			cwd: PKG,
			env,
			encoding: "utf-8",
			timeout: 60_000,
		});
		expect(run.stdout.trim(), run.stderr).toBe("sent");

		const registry = readPromises(fixture.planRoot);
		expect(registry.ok).toBe(true);
		const promise = registry.ok ? registry.registry.promises.find((p) => p.name === PROMISE) : null;
		expect(promise).toBeTruthy();
		if (!promise) return;

		const reader = localSignalReader(fixture.planRoot);
		// Reports newer than this run's start are the child's, not an earlier run's.
		const fresh = (reports: { at: string }[]) =>
			reports.some((r) => Date.parse(r.at) >= startedAt - 1000);
		const read = await until(
			// A new reader per poll: it reads the daemon once per instance.
			() => localSignalReader(fixture.planRoot)(promise),
			(r) => r.ok && CLAUSES.every((c) => fresh(r.byClause[c.name] ?? [])),
		);
		expect(read.ok, read.ok ? "" : read.reason).toBe(true);
		if (!read.ok) return;

		for (const clause of CLAUSES) {
			const reports = read.byClause[clause.name] ?? [];
			expect(fresh(reports), `${clause.name} reported from the real run`).toBe(true);
			expect(clauseStanding(clause, { reports, heartbeatOk: read.heartbeatOk })).toBe("holding");
		}

		const closed = await confirmPlan({
			planRoot: fixture.planRoot,
			codeRoot: fixture.codeRoot,
			plan: PLAN,
			runTests: passingRun(),
			readSignals: reader,
		});
		expect(closed.ok ? [] : closed.refusals.map((r) => r.message)).toEqual([]);
	}, 120_000);
});
