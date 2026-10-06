import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { markPromise } from "../lib/promises/mark.js";
import { trunkCommitMarks } from "../lib/promises/trunk-commit.js";
import { PROMISE_MARK } from "../lib/promises/vocabulary.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: a-plan-is-written-on-its-own-branch — admin-plan-authoring A29.
 *
 * Writing a plan on its own branch is a convention, not a refusal (Sandy,
 * 2026-10-06: "have it stay a convention and then we can see the
 * violations"). Every commit Claude Code makes is read once it lands: a
 * commit on the trunk that is not a merge and changes an active plan's
 * documents is a violation of the promise, naming the plan and the commit; a
 * merge that brings a plan's documents in is the promise upheld. The commit
 * itself is never refused. The marks go to the same telemetry the
 * evaluator's do, read by `indusk promises status`.
 */

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function repo(): { dir: string; commit: (files: Record<string, string>, msg: string) => string } {
	const dir = mkdtempSync(join(tmpdir(), "trunk-mark-"));
	dirs.push(dir);
	git(dir, ["init", "-q", "-b", "main"]);
	writeFileSync(join(dir, "README.md"), "x\n");
	git(dir, ["add", "-A"]);
	git(dir, ["commit", "-qm", "init"]);
	return {
		dir,
		commit(files, msg) {
			for (const [rel, body] of Object.entries(files)) {
				mkdirSync(dirname(join(dir, rel)), { recursive: true });
				writeFileSync(join(dir, rel), body);
			}
			git(dir, ["add", "-A"]);
			git(dir, ["commit", "-qm", msg]);
			return git(dir, ["rev-parse", "HEAD"]);
		},
	};
}

const TRUNKS = ["main", "master"];

describe("A29 — a plan written on main is marked, never refused", () => {
	it("a commit on main that changes an active plan's documents is a violation naming the plan and the commit", async () => {
		const r = repo();
		const sha = r.commit({ ".indusk/planning/seats/brief.md": "# seats\n" }, "plan(seats): brief");
		expect(await trunkCommitMarks(r.dir, sha, TRUNKS)).toEqual([
			{
				plan: "seats",
				outcome: "violated",
				symptom: expect.stringMatching(new RegExp(`seats.*${sha.slice(0, 8)}`)),
			},
		]);
	});

	it("a merge that brings a plan's documents to main is the promise upheld", async () => {
		const r = repo();
		git(r.dir, ["checkout", "-qb", "plan/seats"]);
		r.commit({ ".indusk/planning/seats/brief.md": "# seats\n" }, "plan(seats): brief");
		git(r.dir, ["checkout", "-q", "main"]);
		git(r.dir, ["merge", "-q", "--no-ff", "-m", "plan(seats): approved", "plan/seats"]);
		const sha = git(r.dir, ["rev-parse", "HEAD"]);
		expect(await trunkCommitMarks(r.dir, sha, TRUNKS)).toEqual([
			{ plan: "seats", outcome: "upheld" },
		]);
	});

	it("a commit on a plan's own branch is not the trunk's, and marks nothing", async () => {
		const r = repo();
		git(r.dir, ["checkout", "-qb", "plan/seats"]);
		const sha = r.commit({ ".indusk/planning/seats/brief.md": "# seats\n" }, "plan(seats): brief");
		expect(await trunkCommitMarks(r.dir, sha, TRUNKS)).toEqual([]);
	});

	it("the master plan, current.md and archived plans are not an active plan's documents", async () => {
		const r = repo();
		const sha = r.commit(
			{
				".indusk/planning/master.md": "# plans\n",
				".indusk/current.md": "# now\n",
				".indusk/planning/archive/old/retrospective.md": "# old\n",
			},
			"housekeeping",
		);
		expect(await trunkCommitMarks(r.dir, sha, TRUNKS)).toEqual([]);
	});

	it("one commit touching two plans marks each", async () => {
		const r = repo();
		const sha = r.commit(
			{ ".indusk/planning/seats/brief.md": "a\n", ".indusk/planning/holds/brief.md": "b\n" },
			"two plans",
		);
		const marks = await trunkCommitMarks(r.dir, sha, TRUNKS);
		expect(marks.map((m) => m.plan).sort()).toEqual(["holds", "seats"]);
		expect(marks.every((m) => m.outcome === "violated")).toBe(true);
	});
});

describe("A29 — the mark has one definition", () => {
	it("markPromise writes the promise, the outcome, the project and, on a violation, the symptom", () => {
		const attrs: Record<string, unknown> = {};
		const events: Array<{ name: string; attrs: Record<string, unknown> }> = [];
		const span = {
			setAttribute: (k: string, v: unknown) => {
				attrs[k] = v;
			},
			addEvent: (name: string, a: Record<string, unknown>) => events.push({ name, attrs: a }),
		};
		markPromise(span as never, {
			promise: "a-plan-is-written-on-its-own-branch",
			outcome: "violated",
			project: "proj",
			symptom: "seats was written on main",
		});
		expect(attrs).toEqual({
			[PROMISE_MARK.promise]: "a-plan-is-written-on-its-own-branch",
			[PROMISE_MARK.project]: "proj",
			[PROMISE_MARK.outcome]: "violated",
		});
		expect(events).toEqual([
			{
				name: PROMISE_MARK.violatedEvent,
				attrs: { [PROMISE_MARK.symptom]: "seats was written on main" },
			},
		]);
	});

	it("the evaluator's mark is made with it, and eval-trigger.js marks each commit it sees", () => {
		const otel = readFileSync(join(__dirname, "../lib/eval/otel.ts"), "utf-8");
		expect(otel).toMatch(/markPromise\(/);
		const hook = readFileSync(join(__dirname, "../../hooks/eval-trigger.js"), "utf-8");
		expect(hook).toMatch(/trunk-commit\.js/);
		expect(hook).toMatch(/markTrunkCommit/);
	});
});
