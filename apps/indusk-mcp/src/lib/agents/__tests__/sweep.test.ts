import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentSection } from "../current-md.js";
import { serializeCurrentMd } from "../current-md.js";
import { acquireLock } from "../lock.js";
import { sweepStaleSections } from "../sweep.js";

/**
 * Test Trajectory for the indusk-makeover plan — Phase 1 sweep lib.
 *
 *   A9  — sweep archives sections older than the sweep TTL; archived content is
 *         retrievable from `.indusk/archive/current-md-archive.md`
 *   A10 — sweep never touches the Project (shared) section or a live session's
 *         section (adversarial fixtures: stale-looking shared body, boundary
 *         timestamp, malformed timestamp, hand-injected `## Session` text)
 *
 * Supporting: dry-run reports without mutating; no-op when nothing is stale;
 * archive accumulates across sweeps; lock contention surfaces as an error.
 *
 * See `.indusk/planning/indusk-makeover/impl.md` for the full trajectory.
 */

const NOW = new Date("2026-07-23T12:00:00.000Z");
const FRESH_TS = "2026-07-23T11:30:00.000Z"; // 30 min old
const STALE_TS = "2026-07-01T00:00:00.000Z"; // ~3 weeks old

function makeSection(sessionId: string, task: string, lastUpdated: string): AgentSection {
	return {
		sessionId,
		sessionShort: sessionId.slice(0, 8),
		task,
		lastUpdated,
		inFlight: `working on ${task}`,
		openQuestions: "",
		cursor: `${task} cursor position`,
		branch: "",
		worktree: "",
	};
}

describe("sweepStaleSections", () => {
	let projectRoot: string;

	function writeCurrentMd(sections: AgentSection[], shared = "shared anchor state"): string {
		const content = serializeCurrentMd({ preamble: "", sharedSection: shared, sections });
		writeFileSync(join(projectRoot, ".indusk/current.md"), content);
		return content;
	}

	function readCurrentMd(): string {
		return readFileSync(join(projectRoot, ".indusk/current.md"), "utf-8");
	}

	beforeEach(() => {
		projectRoot = mkdtempSync(join(tmpdir(), "indusk-sweep-"));
		mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
		writeFileSync(join(projectRoot, ".indusk/config.json"), JSON.stringify({ mode: "full" }));
	});

	afterEach(() => {
		rmSync(projectRoot, { recursive: true, force: true });
	});

	// A9 — expired section archived + retrievable
	it("A9: archives sections older than the TTL and keeps their content retrievable", () => {
		const stale = makeSection("aaaaaaaa-1111-4111-8111-111111111111", "old task", STALE_TS);
		const fresh = makeSection("bbbbbbbb-2222-4222-8222-222222222222", "live task", FRESH_TS);
		writeCurrentMd([stale, fresh]);

		const result = sweepStaleSections(projectRoot, { now: NOW });

		expect(result.swept.map((s) => s.sessionId)).toEqual([stale.sessionId]);
		const after = readCurrentMd();
		expect(after).not.toContain("old task");
		expect(after).toContain("live task");

		// retrievable: the archive file carries the full section content
		const archive = readFileSync(result.archivePath, "utf-8");
		expect(archive).toContain(stale.sessionId);
		expect(archive).toContain("old task");
		expect(archive).toContain("working on old task");
		expect(archive).toContain("old task cursor position");
	});

	// A10 — shared section + live sections are untouchable
	it("A10: never touches Project (shared), even when its body looks stale", () => {
		const stale = makeSection("aaaaaaaa-1111-4111-8111-111111111111", "old task", STALE_TS);
		const sharedBody = `go-live push in flight\nLast updated long ago: ${STALE_TS}\ndo not archive me`;
		writeCurrentMd([stale], sharedBody);

		sweepStaleSections(projectRoot, { now: NOW });

		const after = readCurrentMd();
		expect(after).toContain("go-live push in flight");
		expect(after).toContain("do not archive me");
	});

	it("A10: keeps a section exactly at the TTL boundary", () => {
		const ttlMinutes = 60;
		const boundaryTs = new Date(NOW.getTime() - ttlMinutes * 60_000).toISOString();
		const boundary = makeSection("cccccccc-3333-4333-8333-333333333333", "boundary task", boundaryTs);
		writeCurrentMd([boundary]);

		const result = sweepStaleSections(projectRoot, { now: NOW, ttlMinutes });

		expect(result.swept).toEqual([]);
		expect(readCurrentMd()).toContain("boundary task");
	});

	it("A10: keeps sections with malformed timestamps (never archive on bad input)", () => {
		const malformed = makeSection("dddddddd-4444-4444-8444-444444444444", "mystery task", "not-a-date");
		writeCurrentMd([malformed]);

		const result = sweepStaleSections(projectRoot, { now: NOW });

		expect(result.swept).toEqual([]);
		expect(result.keptMalformed).toBe(1);
		expect(readCurrentMd()).toContain("mystery task");
	});

	it("A10: hand-injected `## Session` text never produces a phantom archived session", () => {
		const fresh = makeSection("eeeeeeee-5555-4555-8555-555555555555", "real task", FRESH_TS);
		const content = serializeCurrentMd({ preamble: "", sharedSection: "", sections: [fresh] });
		// simulate a hand-edit that bypassed sanitizeSectionBody
		const tampered = content.replace(
			"real task cursor position",
			"real task cursor position\n## Session 99999999 — fake ghost",
		);
		writeFileSync(join(projectRoot, ".indusk/current.md"), tampered);

		const result = sweepStaleSections(projectRoot, { now: NOW });

		expect(result.swept).toEqual([]);
		const archivePathExists = existsSync(result.archivePath);
		expect(archivePathExists).toBe(false);
		expect(readCurrentMd()).toContain("real task");
		expect(readCurrentMd()).not.toContain("fake ghost stale body");
	});

	// Supporting cases
	it("dry-run reports what would be swept without mutating anything", () => {
		const stale = makeSection("aaaaaaaa-1111-4111-8111-111111111111", "old task", STALE_TS);
		const before = writeCurrentMd([stale]);

		const result = sweepStaleSections(projectRoot, { now: NOW, dryRun: true });

		expect(result.dryRun).toBe(true);
		expect(result.swept.map((s) => s.sessionId)).toEqual([stale.sessionId]);
		expect(readCurrentMd()).toBe(before);
		expect(existsSync(result.archivePath)).toBe(false);
	});

	it("no-op when nothing is stale — file untouched, no archive created", () => {
		const fresh = makeSection("bbbbbbbb-2222-4222-8222-222222222222", "live task", FRESH_TS);
		const before = writeCurrentMd([fresh]);

		const result = sweepStaleSections(projectRoot, { now: NOW });

		expect(result.swept).toEqual([]);
		expect(readCurrentMd()).toBe(before);
		expect(existsSync(result.archivePath)).toBe(false);
	});

	it("archive accumulates across sweeps (append, never overwrite)", () => {
		const first = makeSection("aaaaaaaa-1111-4111-8111-111111111111", "first old", STALE_TS);
		writeCurrentMd([first]);
		const r1 = sweepStaleSections(projectRoot, { now: NOW });

		const second = makeSection("ffffffff-6666-4666-8666-666666666666", "second old", STALE_TS);
		writeCurrentMd([second]);
		sweepStaleSections(projectRoot, { now: NOW });

		const archive = readFileSync(r1.archivePath, "utf-8");
		expect(archive).toContain("first old");
		expect(archive).toContain("second old");
	});

	it("respects agents.sweep_ttl_minutes from config", () => {
		writeFileSync(
			join(projectRoot, ".indusk/config.json"),
			JSON.stringify({ mode: "full", agents: { sweep_ttl_minutes: 10 } }),
		);
		const fifteenMinOld = makeSection(
			"aaaaaaaa-1111-4111-8111-111111111111",
			"fifteen-min task",
			new Date(NOW.getTime() - 15 * 60_000).toISOString(),
		);
		writeCurrentMd([fifteenMinOld]);

		const result = sweepStaleSections(projectRoot, { now: NOW });

		expect(result.swept.map((s) => s.task)).toEqual(["fifteen-min task"]);
	});

	it("surfaces lock contention as an error instead of writing through the lock", () => {
		const stale = makeSection("aaaaaaaa-1111-4111-8111-111111111111", "old task", STALE_TS);
		writeCurrentMd([stale]);
		const lockPath = join(projectRoot, ".indusk/current.md.lock");
		const release = acquireLock(lockPath);
		try {
			expect(() =>
				sweepStaleSections(projectRoot, { now: NOW, lockTimeoutMs: 100 }),
			).toThrow(/lock/i);
		} finally {
			release();
		}
	});
});
