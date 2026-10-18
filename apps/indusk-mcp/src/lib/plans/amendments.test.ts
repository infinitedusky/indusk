import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writePromise } from "../../__tests__/helpers/promises-fixture.js";
import { amendmentsOf, amendmentsWaiting } from "./amendments.js";
import { approvalFrontmatter } from "./approved-brief.js";

/**
 * promise: decisions-wait-in-one-place — plan-stories Build Phase 8, A27: the
 * admin finds a plan waiting on an amendment with `amendmentsWaiting`, read in
 * the checkout the plan is worked in. These tests run it over a real git
 * repository and a real worktree, not the cockpit fixture's stand-in.
 */

const BRIEF = (lead: string) =>
	`# Brief\n\n## Expectations\n\n1. **${lead}** The page answers.\n\n## Promises\n\n### This plan makes\n\nNone — nothing new.\n`;

let base: string;
let main: string;
const git = (cwd: string, ...args: string[]) =>
	execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
		cwd,
		encoding: "utf-8",
	});

const writePlan = (checkout: string, brief: string, impl?: string) => {
	const dir = join(checkout, ".indusk", "planning", "p");
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "brief.md"), brief);
	if (impl !== undefined) writeFileSync(join(dir, "impl.md"), impl);
	return dir;
};

const approvedImpl = (brief: string) =>
	`---\nstatus: approved\n${Object.entries(
		approvalFrontmatter(brief, "t", new Date("2026-10-12T00:00:00Z")),
	)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n")}\n---\n\n# impl\n`;

beforeEach(() => {
	base = realpathSync(mkdtempSync(join(tmpdir(), "amendments-waiting-")));
	main = join(base, "main");
	mkdirSync(main);
	git(main, "init", "-q", "-b", "main");
});
afterEach(() => rmSync(base, { recursive: true, force: true }));

/** Approve `brief` at a commit with the subject `plans approve` writes, then add a worktree. */
function approvedWithWorktree(brief: string, subject = "plan(p): impl approved") {
	writePlan(main, brief, approvedImpl(brief));
	git(main, "add", "-A");
	git(main, "commit", "-q", "-m", subject);
	const wt = join(base, "wt");
	git(main, "worktree", "add", "-q", "-b", "plan/p", wt);
	return join(wt, ".indusk", "planning", "p");
}

describe("amendmentsWaiting finds what a plan's brief says now that it did not at approval", () => {
	it("A27 lists the amendments of a brief changed after approval, read in the plan's worktree", async () => {
		const dir = approvedWithWorktree(BRIEF("Reads fast"));
		writeFileSync(join(dir, "brief.md"), BRIEF("Reads in five seconds"));
		const found = await amendmentsWaiting(dir);
		expect(found.map((a) => a.part)).toEqual(["expectation"]);
		expect(found[0]?.now).toContain("five seconds");
	});

	it("A27 lists none for a brief that is the one approved", async () => {
		const dir = approvedWithWorktree(BRIEF("Reads fast"));
		expect(await amendmentsWaiting(dir)).toEqual([]);
	});

	it("A27 lists none when the approval cannot be read, never an error", async () => {
		const dir = approvedWithWorktree(BRIEF("Reads fast"), "wip: not an approval");
		writeFileSync(join(dir, "brief.md"), BRIEF("Reads in five seconds"));
		expect(await amendmentsWaiting(dir)).toEqual([]);
	});
});

describe("an archived plan's amendments are read against the registry at the project's root", () => {
	// clause: a-plan-is-found-in-the-archive/the-brief-at-approval
	// promise: a-plan-is-found-in-the-archive
	it("T11 a promise only the root registry says the plan owns is compared", async () => {
		// The brief names no promise: the registry alone says `p` owns `held-seat`.
		const brief = BRIEF("Reads fast");
		const promise = (statement: string) =>
			writePromise(join(base, "wt", ".indusk", "promises"), {
				name: "held-seat",
				kind: "state",
				state: "declared",
				domain: "seating",
				owner: "p",
				statement,
			});
		writePlan(main, brief, approvedImpl(brief));
		writePromise(join(main, ".indusk", "promises"), {
			name: "held-seat",
			kind: "state",
			state: "declared",
			domain: "seating",
			owner: "p",
			statement: "A seat is held.",
		});
		git(main, "add", "-A");
		git(main, "commit", "-q", "-m", "plan(p): impl approved");
		const wt = join(base, "wt");
		git(main, "worktree", "add", "-q", "-b", "plan/p", wt);
		mkdirSync(join(wt, ".indusk", "planning", "archive"), { recursive: true });
		git(wt, "mv", ".indusk/planning/p", ".indusk/planning/archive/p");
		promise("A seat is held for ten minutes.");
		const found = await amendmentsOf(join(wt, ".indusk", "planning", "archive", "p"));
		expect(found.map((a) => `${a.part} ${a.name}`)).toContain("promise held-seat");
	});
});
