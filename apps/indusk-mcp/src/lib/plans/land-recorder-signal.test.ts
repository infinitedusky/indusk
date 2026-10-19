// clause: landing-tests-hold-under-load/recorder-waits-for-its-break
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	clausePlanProject,
	failingRun,
	PLAN,
	passingRun,
	testOf,
} from "../../__tests__/helpers/clause-plan-fixture.js";
import type { PromiseProject } from "../../__tests__/helpers/promises-fixture.js";
import { captureTracer } from "../promises/capture-tracer.js";
import { refuseFailingClauseTests } from "./land.js";
import { markRecorderClause } from "./land-recorder-signal.js";

/**
 * a-run-can-be-trusted A90: landing reports `recorder-waits-for-its-break` from the clause-test
 * results it ran: upheld when the recorder test passed, broken naming the landing when it failed.
 * The spans are read from the package's in-memory capture tracer, the attributes the promise
 * reader reads.
 */

const TOKEN = "// clause: landing-tests-hold-under-load/recorder-waits-for-its-break";
const RECORDER = "src/__tests__/admin-recorder.test.ts";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

function codeWith(files: Record<string, string>): PromiseProject {
	fixture = clausePlanProject();
	for (const [rel, text] of Object.entries(files)) {
		const abs = join(fixture.codeRoot, rel);
		mkdirSync(join(abs, ".."), { recursive: true });
		writeFileSync(abs, text);
	}
	return fixture;
}

describe("A90 — landing reports the recorder clause from its test results", () => {
	it("upheld when the recorder test passed", async () => {
		const p = codeWith({ [RECORDER]: `${TOKEN}\n` });
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[{ file: RECORDER, passed: true }],
			tracer,
		);
		expect(spans).toHaveLength(1);
		expect(spans[0].attrs["indusk.promise"]).toBe("landing-tests-hold-under-load");
		expect(spans[0].attrs["indusk.clause"]).toBe("recorder-waits-for-its-break");
		expect(spans[0].attrs["indusk.promise.outcome"]).toBe("upheld");
	});

	it("broken, naming the landing, when it failed", async () => {
		const p = codeWith({ [RECORDER]: `${TOKEN}\n` });
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			"seat-holds",
			[{ file: RECORDER, passed: false }],
			tracer,
		);
		expect(spans).toHaveLength(1);
		expect(spans[0].attrs["indusk.promise.outcome"]).toBe("broken");
		expect(JSON.stringify(spans[0])).toMatch(/landing seat-holds/);
	});

	it("the recorder test failing among several files carrying the clause breaks it, in one report", async () => {
		// A103: only the recorder landing test's result speaks for the clause, so the failure here
		// is its own (the case Build Phase 6's Shape wrote had a unit file fail beside it).
		const p = codeWith({ [RECORDER]: `${TOKEN}\n`, "src/other.test.ts": `${TOKEN}\n` });
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[
				{ file: "src/other.test.ts", passed: true },
				{ file: RECORDER, passed: false },
			],
			tracer,
		);
		expect(spans.map((s) => s.attrs["indusk.promise.outcome"])).toEqual(["broken"]);
	});

	it("a row naming the recorder test from the repo root (apps/indusk-mcp/…) counts", async () => {
		const rooted = `apps/indusk-mcp/${RECORDER}`;
		const p = codeWith({ [rooted]: `${TOKEN}\n` });
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[{ file: rooted, passed: true }],
			tracer,
		);
		expect(spans.map((s) => s.attrs["indusk.promise.outcome"])).toEqual(["upheld"]);
	});

	it("reports nothing when no result's file carries the clause", async () => {
		const p = codeWith({ [RECORDER]: "// nothing\n" });
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[{ file: RECORDER, passed: true }],
			tracer,
		);
		expect(spans).toEqual([]);
	});

	/**
	 * A103 (a-run-can-be-trusted, Build Phase 7, falsification): the unit files carry the clause's
	 * token too, so a landing that ran only them reported the clause upheld although the test that
	 * waits under load never ran.
	 */
	it("A103 a landing whose results carry the clause only in unit files reports nothing", async () => {
		const p = codeWith({
			"src/lib/admin/wait-for-incident.test.ts": `${TOKEN}\n`,
			"src/lib/admin/recorder-loop.scan.test.ts": `${TOKEN}\n`,
			[RECORDER]: `${TOKEN}\n`,
		});
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[
				{ file: "src/lib/admin/wait-for-incident.test.ts", passed: true },
				{ file: "src/lib/admin/recorder-loop.scan.test.ts", passed: true },
			],
			tracer,
		);
		expect(spans).toEqual([]);
	});

	it("A103 a unit file's failure beside a passing recorder test does not decide the clause", async () => {
		const p = codeWith({
			"src/lib/admin/wait-for-incident.test.ts": `${TOKEN}\n`,
			[RECORDER]: `${TOKEN}\n`,
		});
		const { tracer, spans } = captureTracer();
		await markRecorderClause(
			p.planRoot,
			p.codeRoot,
			PLAN,
			[
				{ file: "src/lib/admin/wait-for-incident.test.ts", passed: false },
				{ file: RECORDER, passed: true },
			],
			tracer,
		);
		expect(spans.map((s) => s.attrs["indusk.promise.outcome"])).toEqual(["upheld"]);
	});

	it("plans land reports the failure before it throws its refusal", async () => {
		fixture = clausePlanProject({
			testText: {
				"a-clause": `// promise: a-promise\n// clause: a-promise/a-clause\n${TOKEN}\nimport { expect, it } from "vitest";\nit("x", () => expect(1).toBe(1));\n`,
			},
		});
		// A103: the clause is reported from the recorder landing test's own result, which the
		// runner returns beside the clause tests it was asked for.
		mkdirSync(join(fixture.codeRoot, RECORDER, ".."), { recursive: true });
		writeFileSync(join(fixture.codeRoot, RECORDER), `${TOKEN}\n`);
		const withRecorder =
			(run: ReturnType<typeof passingRun>, passed: boolean): ReturnType<typeof passingRun> =>
			async (files) => [...(await run(files)), { file: RECORDER, passed }];
		const { tracer, spans } = captureTracer();
		await expect(
			refuseFailingClauseTests(
				fixture.planRoot,
				fixture.codeRoot,
				PLAN,
				withRecorder(failingRun(testOf("a-clause")), false),
				tracer,
			),
		).rejects.toThrow(/does not land/);
		expect(spans.map((s) => s.attrs["indusk.promise.outcome"])).toEqual(["broken"]);

		const ok = captureTracer();
		await refuseFailingClauseTests(
			fixture.planRoot,
			fixture.codeRoot,
			PLAN,
			withRecorder(passingRun(), true),
			ok.tracer,
		);
		expect(ok.spans.map((s) => s.attrs["indusk.promise.outcome"])).toEqual(["upheld"]);
	});
});
