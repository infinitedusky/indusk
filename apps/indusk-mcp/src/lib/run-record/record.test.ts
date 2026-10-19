// clause: a-run-is-read-from-its-record/kept-on-disk
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bookkeepingRoots } from "../bookkeeping/roots.js";
import {
	type RunRecord,
	readRunRecord,
	runRecordPath,
	startRunRecord,
	writeRunRecord,
} from "./record.js";

let home: string;
beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "run-record-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

const started = (over: Partial<RunRecord> = {}): RunRecord => ({
	...startRunRecord("p", "build", "2026-10-19T10:00:00.000Z"),
	...over,
});

describe("A1 — a started run leaves a record naming plan, kind, step, phase and process", () => {
	it.each(["build", "planning", "release"] as const)(
		"A1 a %s run's record is read back whole",
		(kind) => {
			const record = started({
				kind,
				step: "work",
				phase: "Build Phase 1",
				process: { pid: 4242, bin: "claude", startedAt: "2026-10-19T10:00:01.000Z" },
			});
			writeRunRecord(home, record);
			expect(readRunRecord(home, "p", kind)).toEqual(record);
		},
	);
});

describe("A2 — the record says at once when a run moves on", () => {
	it("A2 a later write replaces the step and phase; the one left behind is never read", () => {
		writeRunRecord(home, started({ step: "work", phase: "Build Phase 1" }));
		writeRunRecord(home, started({ step: "work", phase: "Build Phase 2" }));
		expect(readRunRecord(home, "p", "build")).toMatchObject({ phase: "Build Phase 2" });
	});

	it("A2 leaves no temporary file behind", () => {
		writeRunRecord(home, started());
		expect(readdirSync(dirname(runRecordPath(home, "p", "build")))).toEqual(["p.build.json"]);
	});
});

describe("A4 — a run that ends on its own has its stop and reason written", () => {
	it("A4 the stop and its reason are read back as written", () => {
		const stop = { step: "amendment", amendments: ["promise x"] };
		writeRunRecord(home, started({ stop, stopReason: "an amendment waits for the person" }));
		expect(readRunRecord(home, "p", "build")).toMatchObject({
			stop,
			stopReason: "an amendment waits for the person",
		});
	});
});

describe("A5 — a record that cannot be read is unknown, never running", () => {
	it("A5 a cut-off file reads unknown and another plan's record is unaffected", () => {
		writeRunRecord(home, started({ plan: "other" }));
		const path = runRecordPath(home, "p", "build");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, '{"plan":"p","kind":"bu');
		expect(readRunRecord(home, "p", "build")).toBe("unknown");
		expect(readRunRecord(home, "other", "build")).toMatchObject({ plan: "other" });
	});

	it("A5 a file of the wrong shape reads unknown, and no file reads null", () => {
		const path = runRecordPath(home, "p", "build");
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify({ plan: "p", kind: "build", pid: "not a number" }));
		expect(readRunRecord(home, "p", "build")).toBe("unknown");
		expect(readRunRecord(home, "p", "release")).toBeNull();
	});
});

describe("A6 — records are per plan and kind", () => {
	it("A6 two plans and one plan's two kinds never read each other's", () => {
		writeRunRecord(home, started({ plan: "a", step: "work" }));
		writeRunRecord(home, started({ plan: "b", step: "falsify" }));
		writeRunRecord(home, started({ plan: "a", kind: "release", step: "retrospective" }));
		expect(readRunRecord(home, "a", "build")).toMatchObject({ step: "work" });
		expect(readRunRecord(home, "b", "build")).toMatchObject({ step: "falsify" });
		expect(readRunRecord(home, "a", "release")).toMatchObject({ step: "retrospective" });
		expect(readRunRecord(home, "b", "release")).toBeNull();
	});

	it("A6 a plan name cannot reach outside the runs folder", () => {
		expect(runRecordPath(home, "../../x", "build").startsWith(join(home, "runs"))).toBe(true);
	});
});

describe("A64 — a record is machine state, outside the repository", () => {
	it("A64 writing a record adds no file under the plan's checkout", () => {
		const checkout = mkdtempSync(join(tmpdir(), "run-record-checkout-"));
		try {
			// The home the admin writes to is the project's own machine-state home, never inside a checkout.
			const machineHome = bookkeepingRoots(checkout, home).home;
			writeRunRecord(machineHome, started());
			expect(readdirSync(checkout)).toEqual([]);
			expect(machineHome.startsWith(checkout)).toBe(false);
			expect(runRecordPath(machineHome, "p", "build").startsWith(checkout)).toBe(false);
			home = machineHome;
			expect(existsSync(runRecordPath(home, "p", "build"))).toBe(true);
		} finally {
			rmSync(checkout, { recursive: true, force: true });
		}
	});
});
