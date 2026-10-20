// clause: admin-pages-load-fast/never-freezes
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { git, initRepoWithCommit } from "../../__tests__/helpers/test-git.js";
import { realProcessReads } from "../process-identity.js";
import { gitCommonDirOf, gitCommonDirOfAsync } from "../worktree/layout.js";
import { processReadsFromTable, readMergeSubjects, readProcessTable } from "./async-reads.js";
import { resetKept } from "./kept-reads.js";
import { realGitReads } from "./landed.js";
import { runStatus } from "./liveness.js";
import { startRunRecord } from "./record.js";

/**
 * A16 (admin-pages-load-fast, Build Phase 1): the asynchronous readers give the same runs and
 * landings as the synchronous ones, over the real `ps` and real git (process starts, so the
 * system tier). The port reader's equivalence is proved in Build Phase 2, where it changes.
 */

let dir: string;
beforeEach(() => {
	resetKept();
	dir = mkdtempSync(join(tmpdir(), "async-reads-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("A16 — asynchronous readers equal the synchronous ones", () => {
	it("A16 a run whose process is this test reads the same, and a dead pid reads stopped in both", async () => {
		const startedAt = realProcessReads.startTime(process.pid)?.toISOString();
		expect(startedAt).toBeDefined();
		const bin = (realProcessReads.command(process.pid) ?? "").split(" ")[0];
		const table = await readProcessTable();
		expect(table).not.toBeNull();
		const live = {
			...startRunRecord("p", "build", startedAt as string),
			process: { pid: process.pid, bin, startedAt: startedAt as string },
		};
		const dead = { ...live, process: { pid: 2_999_999, bin, startedAt: startedAt as string } };
		for (const record of [live, dead])
			expect(runStatus(record, processReadsFromTable(table), false)).toEqual(
				runStatus(record, realProcessReads, false),
			);
		expect(runStatus(live, processReadsFromTable(table), false).state).toBe("running");
	});

	it("A16 the table holds this process's row with the command the per-pid read gives", async () => {
		const table = await readProcessTable();
		const row = table?.find((r) => r.pid === process.pid);
		expect(row?.command).toBe(realProcessReads.command(process.pid));
	});

	it("A16 the merge subjects read asynchronously equal the synchronous read", async () => {
		initRepoWithCommit(dir);
		git(dir, ["checkout", "-q", "-b", "plan/a"]);
		git(dir, ["commit", "-q", "--allow-empty", "-m", "a"]);
		git(dir, ["checkout", "-q", "main"]);
		git(dir, ["merge", "-q", "--no-ff", "-m", "Merge plan/a: a landed", "plan/a"]);
		expect(await readMergeSubjects(dir, "main")).toEqual(realGitReads(dir).mergeSubjects("main"));
		expect(await readMergeSubjects(dir, "main")).toEqual(["Merge plan/a: a landed"]);
	});

	it("A16 the git common directory read asynchronously equals the synchronous read, and a non-repository reads null", async () => {
		initRepoWithCommit(dir);
		expect(await gitCommonDirOfAsync(dir)).toBe(gitCommonDirOf(dir));
		const plain = mkdtempSync(join(tmpdir(), "not-a-repo-"));
		try {
			expect(await gitCommonDirOfAsync(plain)).toBeNull();
		} finally {
			rmSync(plain, { recursive: true, force: true });
		}
	});
});
