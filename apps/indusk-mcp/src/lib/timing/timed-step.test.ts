// clause: a-plan-says-how-long-it-took/steps-are-timed
// clause: a-plan-says-how-long-it-took/a-record-never-blocks
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { readTimings, timingLogPath } from "./log.js";
import { timedStep } from "./timed-step.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
	const d = mkdtempSync(join(tmpdir(), "timed-step-"));
	dirs.push(d);
	return d;
};

function setup(home = tmp()) {
	const root = tmp();
	let t = Date.parse("2026-04-01T09:00:00.000Z");
	const warnings: string[] = [];
	const deps = {
		root,
		plan: "p",
		home,
		now: () => (t += 60_000),
		newId: () => "id-1",
		warn: (m: string) => warnings.push(m),
	};
	return { root, home, deps, warnings };
}
const read = (root: string, home: string) => readTimings(timingLogPath(root, "p", home));

it("A4 a step that finishes leaves a start and an end saying finished, with its phase", async () => {
	const { root, home, deps } = setup();
	const run = timedStep(async (_step: string, _phase?: string) => ({ error: null }), deps);
	expect(await run("work", "Build Phase 2")).toEqual({ error: null });
	const records = await read(root, home);
	expect(records.map((r) => r.kind)).toEqual(["step-start", "step-end"]);
	expect(records[0]).toMatchObject({ id: "id-1", step: "work", phase: "Build Phase 2" });
	expect(records[1]).toMatchObject({ id: "id-1", step: "work", outcome: "finished" });
	expect(Date.parse(records[1].at)).toBeGreaterThan(Date.parse(records[0].at));
});

it("A5 a step returning an error, or throwing, leaves failed; the throw is rethrown unchanged", async () => {
	const failing = setup();
	await timedStep(async (_s: string) => ({ error: "boom" }), failing.deps)("falsify");
	expect((await read(failing.root, failing.home)).at(-1)).toMatchObject({ outcome: "failed" });

	const throwing = setup();
	const err = new Error("exploded");
	await expect(
		timedStep(async (_s: string): Promise<{ error: string | null }> => {
			throw err;
		}, throwing.deps)("audit"),
	).rejects.toBe(err);
	expect((await read(throwing.root, throwing.home)).at(-1)).toMatchObject({ outcome: "failed" });
});

it("A5 classify can name blocked or stopped", async () => {
	for (const outcome of ["blocked", "stopped"] as const) {
		const { root, home, deps } = setup();
		await timedStep(async (_s: string) => ({ error: null }), {
			...deps,
			classify: async () => outcome,
		})("work");
		expect((await read(root, home)).at(-1)).toMatchObject({ outcome });
	}
});

it("A5 a classify that throws changes nothing about the step's result", async () => {
	const { root, home, deps } = setup();
	const result = await timedStep(async (_s: string) => ({ error: null }), {
		...deps,
		classify: async () => {
			throw new Error("cannot classify");
		},
	})("work");
	expect(result).toEqual({ error: null });
	expect((await read(root, home)).at(-1)).toMatchObject({ outcome: "finished" });
});

it("A15 with the log unwritable, the step runs to its normal result and the build carries on", async () => {
	const home = join(tmp(), "afile");
	writeFileSync(home, "not a folder");
	const { deps, warnings } = setup(home);
	let ran = 0;
	const run = timedStep(async (_s: string) => {
		ran++;
		return { error: "its own error" };
	}, deps);
	expect(await run("cleanup")).toEqual({ error: "its own error" });
	expect(ran).toBe(1);
	expect(warnings.join()).toMatch(/timing: could not record/);
});
