import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	createDraft,
	discardDraft,
	listDrafts,
	startFromDraft,
	writeProposal,
} from "../lib/drafts/index.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "./helpers/plan-lifecycle-fixture.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: a-plan-starts-as-a-conversation — brief-as-the-contract A19.
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository — A20, A21.
 *
 * A project that is a real repository, and a project home beside it where a
 * draft lives. A draft is a folder in the home; accepting its proposal makes
 * the plan on its own branch and worktree.
 */

let project: PlanLifecycleProject;
let home: string;
beforeEach(() => {
	project = planLifecycleProject("drafts");
	home = mkdtempSync(join(tmpdir(), "drafts-home-"));
});
afterEach(() => {
	project.cleanup();
	rmSync(home, { recursive: true, force: true });
});

const trunk = () => project.trunk;
const branchExists = (name: string) =>
	git(trunk(), ["branch", "--list", name, "--format=%(refname:short)"]) === name;
const branches = () =>
	git(trunk(), ["branch", "--format=%(refname:short)"]).split("\n").filter(Boolean).sort();
/** `git status` of the trunk and of every worktree of it, as one list: nothing means nothing was written. */
const gitStatusAcrossWorktrees = () =>
	git(trunk(), ["worktree", "list", "--porcelain"])
		.split("\n")
		.filter((l) => l.startsWith("worktree "))
		.flatMap((l) => git(l.slice("worktree ".length), ["status", "--porcelain"]).split("\n"))
		.filter(Boolean);

describe("a plan starts from a draft", () => {
	it("A19 accepting the proposal makes the plan on its own branch with the draft as its brief", async () => {
		const draft = createDraft(home, { brief: "# draft\n\nA promise.\n" });
		writeProposal(draft, { name: "phone-nav", type: "bugfix" });
		const started = await startFromDraft(trunk(), draft);

		expect(branchExists("plan/phone-nav")).toBe(true);
		expect(existsSync(started.worktree)).toBe(true);
		expect(git(started.worktree, ["rev-parse", "--abbrev-ref", "HEAD"])).toBe("plan/phone-nav");
		const brief = readFileSync(
			join(started.worktree, ".indusk/planning/phone-nav/brief.md"),
			"utf-8",
		);
		expect(brief).toContain("# draft");
		expect(brief).toContain("workflow: bugfix");
		// the draft is spent once it is a plan
		expect(listDrafts(home)).toEqual([]);

		// a name already taken is refused, another is asked for, and the draft is kept
		const second = createDraft(home, { brief: "# another\n" });
		writeProposal(second, { name: "phone-nav", type: "bugfix" });
		await expect(startFromDraft(trunk(), second)).rejects.toThrow(/already.*another name/s);
		expect(listDrafts(home).map((d) => d.id)).toEqual([second.id]);
	});

	it("A20 a conversation not kept leaves nothing in any checkout, and is listed, reopened or discarded", () => {
		const before = branches();
		const draft = createDraft(home, { brief: "# draft\n" });
		expect(draft.dir.startsWith(trunk())).toBe(false);
		expect(gitStatusAcrossWorktrees()).toEqual([]);
		expect(branches()).toEqual(before);
		expect(listDrafts(home).map((d) => d.id)).toContain(draft.id);
		// reopened: the folder still holds what was said
		expect(readFileSync(join(draft.dir, "brief.md"), "utf-8")).toContain("# draft");
		discardDraft(home, draft.id);
		expect(listDrafts(home)).toEqual([]);
		expect(existsSync(draft.dir)).toBe(false);
	});

	it("A21 a kept conversation with no promises or looks becomes research alone; one with a brief keeps it", async () => {
		const notes = createDraft(home, { research: "# notes\n" });
		writeProposal(notes, { name: "remember-this", type: "spike" });
		const research = await startFromDraft(trunk(), notes);
		const folder = join(research.worktree, ".indusk/planning/remember-this");
		expect(existsSync(join(folder, "research.md"))).toBe(true);
		expect(existsSync(join(folder, "brief.md"))).toBe(false);

		const made = createDraft(home, { brief: "# promises\n" });
		writeProposal(made, { name: "has-promises", type: "feature" });
		const feature = await startFromDraft(trunk(), made);
		expect(existsSync(join(feature.worktree, ".indusk/planning/has-promises/brief.md"))).toBe(true);
	});
});

describe("a draft that held both documents keeps both", () => {
	it("A36 accepting a draft with a brief and research puts both in the new plan", async () => {
		const draft = createDraft(home, { brief: "# promises\n", research: "# what we found\n" });
		writeProposal(draft, { name: "keeps-both", type: "feature" });
		const started = await startFromDraft(trunk(), draft);

		const folder = join(started.worktree, ".indusk/planning/keeps-both");
		expect(readFileSync(join(folder, "brief.md"), "utf-8")).toContain("# promises");
		expect(existsSync(join(folder, "research.md"))).toBe(true);
		expect(readFileSync(join(folder, "research.md"), "utf-8")).toContain("# what we found");
		// Committed with the brief, so the branch holds it and not only the folder.
		expect(git(started.worktree, ["ls-files", ".indusk/planning/keeps-both"])).toContain(
			"research.md",
		);
	});
});
