import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildTwoRepoWorkbench, type TwoRepoFixture } from "./helpers/worktree-fixture.js";

/**
 * A4 / A5 — two machines writing at once.
 *
 * A4's observable contract is deliberately about the ABSENCE of an
 * interaction: nobody is ever asked to resolve anything. That holds whether
 * the push-reject retry or the blind content merge did the work, which is why
 * the assertion does not name a mechanism.
 *
 * A5 is the falsification surface the brief flagged: `merge=union` plus
 * content-keyed dedup was built for rebase noise, not for two writers
 * appending to the same log. This is where that gets proven rather than
 * assumed, so it interleaves rather than running one side to completion.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let fixture: TwoRepoFixture;

afterEach(() => {
	fixture?.cleanup();
});

function runCli(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		cwd,
		encoding: "utf-8",
		env: { ...process.env, INDUSK_SKIP_UPDATE_CHECK: "1" },
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

/** Anything that would make a human stop and fix a merge by hand. */
const RESOLUTION_DEMANDED = /CONFLICT|Automatic merge failed|fix conflicts|Merge conflict|<<<<<<</i;

describe.skipIf(SHOULD_SKIP)("A4 — concurrent edits never demand resolution", () => {
	it("lands both sides across interleaved rounds, prompting nobody", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const a = fixture.workbenchDir;
		const b = join(fixture.root, "machine-b");
		fixture.cloneWorkbenchTo(b);

		// Interleaved, not one-then-the-other: a single round can pass by luck
		// because one side simply won the race and never had to merge.
		for (let round = 0; round < 4; round++) {
			writeFileSync(join(a, ".indusk", "planning", "sample-plan", `a-${round}.md`), `A${round}\n`);
			writeFileSync(join(b, ".indusk", "planning", "sample-plan", `b-${round}.md`), `B${round}\n`);

			const ra = runCli(a, ["workbench", "sync"]);
			const rb = runCli(b, ["workbench", "sync"]);

			for (const r of [ra, rb]) {
				expect(r.code).toBe(0);
				expect(`${r.stdout}${r.stderr}`).not.toMatch(RESOLUTION_DEMANDED);
			}
		}

		// After a final settling round both machines hold everything.
		runCli(a, ["workbench", "sync"]);
		runCli(b, ["workbench", "sync"]);
		runCli(a, ["workbench", "sync"]);

		for (let round = 0; round < 4; round++) {
			expect(existsSync(join(a, ".indusk", "planning", "sample-plan", `b-${round}.md`))).toBe(true);
			expect(existsSync(join(b, ".indusk", "planning", "sample-plan", `a-${round}.md`))).toBe(true);
		}
	});
});

describe.skipIf(SHOULD_SKIP)("A5 — concurrent appends both survive", () => {
	it("keeps both machines' lines in the append-shaped files", { timeout: 30_000 }, () => {
		fixture = buildTwoRepoWorkbench({ gitInitWorkbench: true });
		const a = fixture.workbenchDir;
		const b = join(fixture.root, "machine-b");
		fixture.cloneWorkbenchTo(b);

		const rel = join(".indusk", "highlights.jsonl");
		writeFileSync(join(a, rel), '{"id":"seed"}\n');
		runCli(a, ["workbench", "sync"]);
		runCli(b, ["workbench", "sync"]);

		// Both append to the same file before either syncs — the multi-writer
		// case union-merge was never designed for.
		appendFileSync(join(a, rel), '{"id":"from-a"}\n');
		appendFileSync(join(b, rel), '{"id":"from-b"}\n');

		runCli(a, ["workbench", "sync"]);
		runCli(b, ["workbench", "sync"]);
		runCli(a, ["workbench", "sync"]);

		for (const machine of [a, b]) {
			const merged = readFileSync(join(machine, rel), "utf-8");
			expect(merged).toContain("from-a");
			expect(merged).toContain("from-b");
			// Union-merge duplicating a line is a real outcome, not a
			// hypothetical — the seed must appear exactly once.
			expect(merged.split("\n").filter((l) => l.includes('"seed"')).length).toBe(1);
		}
	});
});
