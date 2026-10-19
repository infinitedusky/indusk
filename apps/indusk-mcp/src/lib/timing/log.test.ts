// clause: a-plan-says-how-long-it-took/a-record-never-blocks
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { appendTiming, readTimings, timingLogPath } from "./log.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
	const d = mkdtempSync(join(tmpdir(), "timing-log-"));
	dirs.push(d);
	return d;
};

it("A17 a garbage line, a half-written last line and an older shape are skipped, the good ones kept in order", async () => {
	const path = join(tmp(), "plan.jsonl");
	const good1 = { v: 1, kind: "phase-close", plan: "p", at: "2026-01-01T00:00:00.000Z", phase: 1 };
	const good2 = {
		v: 1,
		kind: "step-start",
		plan: "p",
		at: "2026-01-01T00:01:00.000Z",
		id: "a",
		step: "work",
	};
	writeFileSync(
		path,
		[
			JSON.stringify(good1),
			"not json at all",
			JSON.stringify({ v: 2, kind: "phase-close", plan: "p", at: "x", phase: 2 }),
			JSON.stringify({ v: 1, kind: "mystery", plan: "p", at: "x" }),
			"[1,2]",
			JSON.stringify(good2),
			'{"v":1,"kind":"phase-cl',
		].join("\n"),
	);
	expect(await readTimings(path)).toEqual([good1, good2]);
});

it("A17 a missing file reads as no records", async () => {
	expect(await readTimings(join(tmp(), "none.jsonl"))).toEqual([]);
});

it("appendTiming stamps the version and the injected time, and creates the folder", async () => {
	const path = join(tmp(), "a", "b", "p.jsonl");
	await appendTiming(path, { kind: "phase-close", plan: "p", phase: 1, sha: "abc" }, () =>
		Date.parse("2026-02-03T04:05:06.000Z"),
	);
	expect(await readTimings(path)).toEqual([
		{ v: 1, kind: "phase-close", plan: "p", at: "2026-02-03T04:05:06.000Z", phase: 1, sha: "abc" },
	]);
});

it("the log lives under the project's home, named for the plan", () => {
	const home = tmp();
	expect(timingLogPath(home, "my-plan", home)).toMatch(/timing\/my-plan\.jsonl$/);
});
