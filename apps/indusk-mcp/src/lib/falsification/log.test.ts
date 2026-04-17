import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	appendHypothesis,
	isFalsificationComplete,
	type LogEntry,
	markTerminated,
	readFalsificationLog,
} from "./log.js";

let planRoot: string;

beforeEach(() => {
	planRoot = join(
		tmpdir(),
		`falsification-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(planRoot, { recursive: true });
});

afterEach(() => {
	rmSync(planRoot, { recursive: true, force: true });
});

describe("T1: appendHypothesis creates log file if missing and appends structured entries", () => {
	it("creates the log file with a header on first append", () => {
		const entry = appendHypothesis(planRoot, {
			hypothesis: "table.actionTaken is called directly, bypassing GameEngine",
			testPath: "apps/game/src/__tests__/interface-bypass.test.ts",
			outcome: "fix-in-scope",
		});

		expect(entry.kind).toBe("hypothesis");
		expect(entry.hypothesis).toContain("bypassing GameEngine");
		expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		const entries = readFalsificationLog(planRoot);
		expect(entries.length).toBe(1);
		expect(entries[0].kind).toBe("hypothesis");
	});

	it("appends multiple entries in order", () => {
		appendHypothesis(planRoot, {
			hypothesis: "first hypothesis",
			testPath: "test1.ts",
			outcome: "fix-in-scope",
		});
		appendHypothesis(planRoot, {
			hypothesis: "second hypothesis",
			testPath: "test2.ts",
			outcome: "spawn-plan",
		});
		appendHypothesis(planRoot, {
			hypothesis: "third hypothesis",
			testPath: null,
			outcome: "accept-finding",
		});

		const entries = readFalsificationLog(planRoot);
		expect(entries.length).toBe(3);
		expect((entries[0] as { hypothesis: string }).hypothesis).toBe("first hypothesis");
		expect((entries[1] as { hypothesis: string }).hypothesis).toBe("second hypothesis");
		expect((entries[2] as { hypothesis: string }).hypothesis).toBe("third hypothesis");
	});

	it("preserves note when provided", () => {
		appendHypothesis(planRoot, {
			hypothesis: "h",
			testPath: "t.ts",
			outcome: "fix-in-scope",
			note: "discovered during race-condition investigation",
		});
		const entries = readFalsificationLog(planRoot) as [Extract<LogEntry, { kind: "hypothesis" }>];
		expect(entries[0].note).toBe("discovered during race-condition investigation");
	});
});

describe("T2: readFalsificationLog parses entries back in insertion order", () => {
	it("round-trips hypothesis entries preserving fields", () => {
		appendHypothesis(planRoot, {
			hypothesis: "h1",
			testPath: "a.ts",
			outcome: "fix-in-scope",
		});
		appendHypothesis(planRoot, {
			hypothesis: "h2",
			testPath: null,
			outcome: "spawn-plan",
		});
		const entries = readFalsificationLog(planRoot);
		expect(entries[0]).toMatchObject({
			kind: "hypothesis",
			hypothesis: "h1",
			testPath: "a.ts",
			outcome: "fix-in-scope",
		});
		expect(entries[1]).toMatchObject({
			kind: "hypothesis",
			hypothesis: "h2",
			testPath: null,
			outcome: "spawn-plan",
		});
	});
});

describe("T3: markTerminated appends terminator and subsequent read includes it", () => {
	it("appends a terminator after hypotheses", () => {
		appendHypothesis(planRoot, {
			hypothesis: "h1",
			testPath: "t.ts",
			outcome: "fix-in-scope",
		});
		markTerminated(planRoot, "investigated three attack surfaces; none produced in-scope failure");
		const entries = readFalsificationLog(planRoot);
		expect(entries.length).toBe(2);
		expect(entries[1].kind).toBe("terminator");
		expect((entries[1] as { reason: string }).reason).toContain(
			"investigated three attack surfaces",
		);
	});

	it("throws when appending after a terminator", () => {
		markTerminated(planRoot, "no hypotheses, clean close");
		expect(() =>
			appendHypothesis(planRoot, {
				hypothesis: "late",
				testPath: null,
				outcome: "fix-in-scope",
			}),
		).toThrow(/already terminated/);
	});

	it("throws on double terminator", () => {
		markTerminated(planRoot, "first reason");
		expect(() => markTerminated(planRoot, "second reason")).toThrow(/already terminated/);
	});

	it("throws on empty reason", () => {
		expect(() => markTerminated(planRoot, "")).toThrow(/non-empty reason/);
		expect(() => markTerminated(planRoot, "   ")).toThrow(/non-empty reason/);
	});
});

describe("T4: isFalsificationComplete returns correct state across log lifecycle", () => {
	it("returns false when log doesn't exist", () => {
		expect(isFalsificationComplete(planRoot)).toBe(false);
	});

	it("returns false when log has only hypotheses (not terminated)", () => {
		appendHypothesis(planRoot, {
			hypothesis: "h",
			testPath: "t.ts",
			outcome: "fix-in-scope",
		});
		expect(isFalsificationComplete(planRoot)).toBe(false);
	});

	it("returns true when log has a terminator as the last entry", () => {
		appendHypothesis(planRoot, {
			hypothesis: "h",
			testPath: "t.ts",
			outcome: "fix-in-scope",
		});
		markTerminated(planRoot, "done");
		expect(isFalsificationComplete(planRoot)).toBe(true);
	});

	it("returns true when log only has a terminator (no hypotheses)", () => {
		markTerminated(planRoot, "no attack surfaces found on initial investigation");
		expect(isFalsificationComplete(planRoot)).toBe(true);
	});
});

describe("T6: readFalsificationLog handles missing file gracefully", () => {
	it("returns empty array when log file is absent", () => {
		expect(readFalsificationLog(planRoot)).toEqual([]);
	});

	it("does not throw on a missing file", () => {
		expect(() => readFalsificationLog(planRoot)).not.toThrow();
	});

	it("skips malformed entries and calls onMalformed callback", () => {
		const logPath = join(planRoot, "falsification.md");
		writeFileSync(
			logPath,
			`# Falsification Log — test\n\n## Hypothesis 2026-04-17T00:00:00Z\n\n**Hypothesis:** valid one\n**Test:** t.ts\n**Outcome:** fix-in-scope\n\n## Hypothesis 2026-04-17T00:00:01Z\n\n(missing required fields)\n\n## Hypothesis 2026-04-17T00:00:02Z\n\n**Hypothesis:** another valid\n**Test:** u.ts\n**Outcome:** fix-in-scope\n\n`,
			"utf-8",
		);
		const malformed: unknown[] = [];
		const entries = readFalsificationLog(planRoot, {
			onMalformed: (m) => malformed.push(m),
		});
		expect(entries.length).toBe(2);
		expect(malformed.length).toBe(1);
	});
});
