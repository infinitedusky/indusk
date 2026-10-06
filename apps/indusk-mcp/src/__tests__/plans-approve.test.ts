import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import {
	DOMAIN,
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: a-plan-is-written-on-its-own-branch — admin-plan-authoring A9.
 * promise: a-briefs-promises-are-in-the-registry — admin-plan-authoring A23.
 *
 * Approving a plan brings its documents and declared promises to `main` in
 * one merge, and its build carries on in the same worktree on the same
 * branch. Approval runs the brief check the command line runs and refuses
 * with its message; and a branch that already holds code is not a plan
 * waiting for approval, so it is refused too. Through the CLI.
 *
 * The worktree is made with `indusk worktree create`, so these rows do not
 * depend on `plans start`.
 */

const PLAN = "seat-holds";
const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";

let p: PlanLifecycleProject;
let wt: string;
beforeEach(() => {
	p = planLifecycleProject("plans-approve");
	wt = p.makeWorktree(PLAN);
});
afterEach(() => p.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;
const planDir = `.indusk/planning/${PLAN}`;

/** The plan's documents on its branch; `declare` false leaves its promise out of the registry. */
function writePlan(opts: { declare?: boolean; extra?: Record<string, string> } = {}): void {
	if (opts.declare !== false) {
		writePromise(join(wt, ".indusk", "promises"), {
			name: NAME,
			kind: "state",
			state: "declared",
			domain: DOMAIN,
			owner: PLAN,
			statement: SENTENCE,
		});
	}
	p.commit(
		wt,
		{
			[`${planDir}/brief.md`]: briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] }),
			[`${planDir}/impl.md`]: implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
			...(opts.extra ?? {}),
		},
		"plan documents",
	);
}

describe.skipIf(SHOULD_SKIP)("indusk plans approve", () => {
	it("A9 — merges the documents and promises into main; the build continues on the same branch", () => {
		writePlan();
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code, out(r)).toBe(0);

		const main = p.onMain();
		expect(main).toContain(`${planDir}/brief.md`);
		expect(main).toContain(`.indusk/promises/${NAME}.md`);
		expect(git(p.trunk, ["rev-list", "--parents", "-n", "1", "main"]).split(" ")).toHaveLength(3);

		expect(git(wt, ["branch", "--show-current"])).toBe(`plan/${PLAN}`);
		const impl = matter(readFileSync(join(wt, planDir, "impl.md"), "utf-8"));
		expect(impl.data.status).toBe("approved");
		const onMain = matter(git(p.trunk, ["show", `main:${planDir}/impl.md`]));
		expect(onMain.data.status).toBe("approved");
	});

	it("A23 — a brief naming a promise the registry does not hold is refused with the contract's message; main unchanged", () => {
		writePlan({ declare: false });
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain(
			`${NAME}: the brief says ${PLAN} makes this promise, but the registry does not hold it`,
		);
		expect(p.mainSha()).toBe(before);
	});

	it("A9 — a branch that changes anything outside .indusk/ is refused, naming the file; main unchanged", () => {
		writePlan({ extra: { "src/seat.ts": "export const seat = 1;\n" } });
		const before = p.mainSha();
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("src/seat.ts");
		expect(p.mainSha()).toBe(before);
	});

	it("A9 — documents the planning session wrote but did not commit are committed by approval and merged", () => {
		// Found in Build Phase 9's live check: a planning session writes its
		// documents and promises and leaves them uncommitted.
		p.commit(wt, { [`${planDir}/brief.md`]: "# started\n" }, "plan started");
		writePromise(join(wt, ".indusk", "promises"), {
			name: NAME,
			kind: "state",
			state: "declared",
			domain: DOMAIN,
			owner: PLAN,
			statement: SENTENCE,
		});
		writeFileSync(
			join(wt, planDir, "brief.md"),
			briefText(PLAN, { makes: [{ name: NAME, sentence: SENTENCE }] }),
		);
		writeFileSync(
			join(wt, planDir, "impl.md"),
			implText(PLAN, { status: "draft", rows: [{ state: "planned" }] }),
		);
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code, out(r)).toBe(0);
		expect(p.onMain()).toEqual(
			expect.arrayContaining([`${planDir}/impl.md`, `.indusk/promises/${NAME}.md`]),
		);
		expect(git(wt, ["status", "--porcelain"])).toBe("");
	});

	it("A9 — uncommitted work outside .indusk/ is refused, naming it; nothing is committed", () => {
		writePlan();
		writeFileSync(join(wt, "seat.ts"), "export const seat = 1;\n");
		const head = git(wt, ["rev-parse", "HEAD"]);
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code).not.toBe(0);
		expect(out(r)).toContain("seat.ts");
		expect(git(wt, ["rev-parse", "HEAD"])).toBe(head);
	});

	it("A32 — InDusk's own notes uncommitted on main do not block approval: committed as bookkeeping first", () => {
		writeFileSync(join(p.trunk, ".gitattributes"), ".indusk/current.md merge=union\n");
		writeFileSync(join(p.trunk, ".indusk", "current.md"), "# now\n");
		git(p.trunk, ["add", "-A"]);
		git(p.trunk, ["commit", "-qm", "current.md"]);
		git(wt, ["merge", "-q", "main"]);
		writePlan({ extra: { ".indusk/current.md": "# now\n\n## Session plan — seat-holds\n" } });
		writeFileSync(join(p.trunk, ".indusk", "current.md"), "# now\n\n## Session eval — notes\n");
		const r = runCli(p.trunk, ["plans", "approve", PLAN]);
		expect(r.code, out(r)).toBe(0);
		expect(git(p.trunk, ["log", "--format=%s", "main"])).toMatch(/bookkeeping/);
		expect(git(p.trunk, ["status", "--porcelain"])).toBe("");
	});
});
