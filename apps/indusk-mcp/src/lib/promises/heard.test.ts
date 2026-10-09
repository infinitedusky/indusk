import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	answering,
	jsonLines,
	PROMISE,
	recordingProject,
	TRACE,
	violation,
} from "../../__tests__/helpers/record-fixture.js";
import { recordBreaks } from "./record.js";

/**
 * incident-recording A20 — promise: the-admin-keeps-what-it-heard.
 *
 * Every pass appends what it heard to the project's record in its home — per
 * violation: when it happened, the promise, the trace and the incident it now
 * belongs to — so the promise page can count breaks past the source's
 * retention and while no page was open. A pass that heard nothing appends
 * nothing, and the record never holds a trace twice.
 */

const SECOND = "5cf92f3577b34da6a3ce929d0e0e4737";

let home: string;
const cleanups: (() => void)[] = [];
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "heard-home-"));
	cleanups.push(() => rmSync(home, { recursive: true, force: true }));
});
afterEach(() => {
	for (const c of cleanups.splice(0).reverse()) c();
});

type Heard = { at: string; promise: string; trace: string; incident: string; source: string };

describe("A20 — each pass keeps what it heard", () => {
	it("one row per violation, with when, the promise, the trace and its incident", async () => {
		const fx = recordingProject();
		cleanups.push(fx.cleanup);
		const r = await recordBreaks(
			fx.root,
			{ by: "admin", source: "deployed" },
			{
				reads: answering([
					violation(TRACE, "2026-10-08T20:00:00Z"),
					violation(SECOND, "2026-10-08T20:01:00Z"),
				]),
				mark: () => {},
				home,
			},
		);
		const id = r.opened[0]?.id;
		const rows = jsonLines<Heard>(home, "heard.jsonl");
		expect(rows).toEqual(
			expect.arrayContaining([
				{
					at: "2026-10-08T20:00:00.000Z",
					promise: PROMISE,
					trace: TRACE,
					incident: id,
					source: "production",
				},
				{
					at: "2026-10-08T20:01:00.000Z",
					promise: PROMISE,
					trace: SECOND,
					incident: id,
					source: "production",
				},
			]),
		);
		expect(rows).toHaveLength(2);
	});

	it("never holds a trace twice, and a pass that heard nothing appends nothing", async () => {
		const fx = recordingProject();
		cleanups.push(fx.cleanup);
		const d = (traces: string[]) => ({ reads: answering(traces), mark: () => {}, home });
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, d([TRACE]));
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, d([TRACE]));
		await recordBreaks(fx.root, { by: "admin", source: "deployed" }, d([]));
		expect(jsonLines<Heard>(home, "heard.jsonl").map((r) => r.trace)).toEqual([TRACE]);
	});
});
