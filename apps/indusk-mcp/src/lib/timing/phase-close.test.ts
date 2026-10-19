// clause: a-plan-says-how-long-it-took/phases-are-timed
// clause: a-plan-says-how-long-it-took/a-record-never-blocks
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { recordPhaseStart } from "../shape/boundary.js";
import { readTimings, timingLogPath } from "./log.js";
import { recordPhaseClose } from "./phase-close.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
	const d = mkdtempSync(join(tmpdir(), "timing-close-"));
	dirs.push(d);
	return d;
};
const T0 = "2026-03-01T10:00:00.000Z";
const at = (min: number) => () => Date.parse(T0) + min * 60_000;

function setup() {
	const root = tmp();
	const home = tmp();
	const warnings: string[] = [];
	return { root, home, warnings, warn: (m: string) => warnings.push(m) };
}
const open = (root: string, phase = 1, kind?: "test" | "build") =>
	recordPhaseStart(root, { plan: "p", phase, kind, sha: "sha1", at: T0 });

it("A1 opening a phase still records its opening the way it always did", async () => {
	const { root } = setup();
	await open(root);
	const { readBoundaries } = await import("../shape/boundary.js");
	expect(await readBoundaries(root)).toEqual([{ plan: "p", phase: 1, sha: "sha1", timestamp: T0 }]);
});

it("A2 closing an open phase appends one phase-close no earlier than its opening", async () => {
	const { root, home, warn } = setup();
	await open(root);
	await recordPhaseClose(root, { plan: "p", phase: 1, sha: "sha2", now: at(30), home, warn });
	const records = await readTimings(timingLogPath(root, "p", home));
	expect(records).toEqual([
		{
			v: 1,
			kind: "phase-close",
			plan: "p",
			at: new Date(Date.parse(T0) + 30 * 60_000).toISOString(),
			phase: 1,
			sha: "sha2",
		},
	]);
});

it("A2 a close that would be earlier than its opening writes nothing and warns", async () => {
	const { root, home, warnings, warn } = setup();
	await open(root);
	await recordPhaseClose(root, { plan: "p", phase: 1, sha: "s", now: at(-5), home, warn });
	expect(await readTimings(timingLogPath(root, "p", home))).toEqual([]);
	expect(warnings.join()).toMatch(/earlier than/);
});

it("A3 a phase closed twice keeps the first close", async () => {
	const { root, home, warn } = setup();
	await open(root);
	await recordPhaseClose(root, { plan: "p", phase: 1, sha: "s", now: at(10), home, warn });
	await recordPhaseClose(root, { plan: "p", phase: 1, sha: "s", now: at(20), home, warn });
	const records = await readTimings(timingLogPath(root, "p", home));
	expect(records).toHaveLength(1);
	expect(records[0].at).toBe(new Date(Date.parse(T0) + 10 * 60_000).toISOString());
});

it("A3 a phase closed without having been opened writes nothing and warns", async () => {
	const { root, home, warnings, warn } = setup();
	await recordPhaseClose(root, { plan: "p", phase: 2, sha: "s", now: at(10), home, warn });
	expect(await readTimings(timingLogPath(root, "p", home))).toEqual([]);
	expect(warnings.join()).toMatch(/never opened/);
});

it("A3 a test phase and a build phase of the same number are closed separately", async () => {
	const { root, home, warn } = setup();
	await open(root, 1, "test");
	await open(root, 1, "build");
	await recordPhaseClose(root, { plan: "p", phase: 1, kind: "test", sha: "s", now: at(5), home, warn });
	await recordPhaseClose(root, { plan: "p", phase: 1, kind: "build", sha: "s", now: at(9), home, warn });
	const records = await readTimings(timingLogPath(root, "p", home));
	expect(records.map((r) => r.kind === "phase-close" && r.kind && (r as { phase: number }).phase)).toEqual([1, 1]);
	expect(records).toHaveLength(2);
});

it("A14 with the timing folder unwritable, closing resolves with a warning", async () => {
	const { root, warnings, warn } = setup();
	await open(root);
	const home = join(tmp(), "afile");
	writeFileSync(home, "not a folder");
	await expect(
		recordPhaseClose(root, { plan: "p", phase: 1, sha: "s", now: at(5), home, warn }),
	).resolves.toBeUndefined();
	expect(warnings.join()).toMatch(/timing: could not record/);
});

it("A14 with the boundary record corrupt, closing resolves with a warning", async () => {
	const { root, home, warnings, warn } = setup();
	await open(root);
	writeFileSync(join(root, ".indusk", "phase-boundary.jsonl"), "garbage\n");
	await expect(
		recordPhaseClose(root, { plan: "p", phase: 1, sha: "s", now: at(5), home, warn }),
	).resolves.toBeUndefined();
	expect(warnings.join()).toMatch(/timing: could not record/);
});
