import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approve } from "../lib/looks/approve.js";
import {
	APP,
	type BriefAppProject,
	briefAppProject,
	briefOf,
	briefWorkbench,
	PLAN,
	PLAN_DIR,
} from "./helpers/brief-app.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { git } from "./helpers/test-git.js";

/**
 * promise: a-plan-is-approved-with-its-looks-approved — brief-as-the-contract A8, A24.
 * promise: approval-is-of-the-brief — brief-as-the-contract A9.
 *
 * A23, a regression guard (the form goes, the command stays): `indusk plans
 * start` works as before.
 *
 * `indusk plans approve` over the `brief-app` fixture: a plan is approved only
 * after the looks its brief makes are approved in its worktree's record, and
 * what it approves is the brief, recorded by its hash in the impl.
 */

let app: BriefAppProject;
beforeEach(() => {
	app = briefAppProject("plans-approve-looks");
});
afterEach(() => app.cleanup());

const out = (r: { stdout: string; stderr: string }) => `${r.stdout}\n${r.stderr}`;
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe.skipIf(SHOULD_SKIP)("approval and the looks a brief names", () => {
	it("A8 a plan whose brief makes a look still proposed is refused naming it; once approved the same plan is approved", async () => {
		app.writePlan({ brief: "looks-listed", impl: "internal" });
		const before = app.project.mainSha();

		const refused = runCli(app.trunk, ["plans", "approve", PLAN]);
		expect(refused.code, out(refused)).not.toBe(0);
		expect(out(refused)).toContain("home.full");
		expect(app.project.mainSha()).toBe(before);

		// The brief names three proposed mockups (it makes home.full, changes
		// detail.default, replaces badge.old by badge.ok — a new component drawn
		// as its own mockup); the plan is approved once the person has approved each.
		for (const look of ["home.full", "detail.default", "badge.ok"]) {
			const person = await approve(app.wt, APP, look, "sandy");
			expect(person.approved, JSON.stringify(person)).toBe(true);
		}
		const approved = runCli(app.trunk, ["plans", "approve", PLAN]);
		expect(approved.code, out(approved)).toBe(0);
	});
});

describe.skipIf(SHOULD_SKIP)("a workbench plan is held to its looks as a normal plan is", () => {
	it("A33 approval and re-approval of a workbench plan are refused naming a look its brief names that is still proposed; once approved the same plan is approved", async () => {
		const bench = briefWorkbench();
		try {
			bench.writePlan({ brief: "looks-listed", impl: "internal" });
			const rootHead = () => git(bench.root, ["rev-parse", "HEAD"]);
			const before = rootHead();

			const refused = runCli(bench.root, ["plans", "approve", PLAN]);
			expect(refused.code, out(refused)).not.toBe(0);
			expect(out(refused)).toContain("home.full");
			expect(rootHead()).toBe(before);

			for (const look of ["home.full", "detail.default", "badge.ok"]) {
				const person = await approve(bench.root, APP, look, "sandy");
				expect(person.approved, JSON.stringify(person)).toBe(true);
			}
			const approved = runCli(bench.root, ["plans", "approve", PLAN]);
			expect(approved.code, out(approved)).toBe(0);

			// A look the plan makes is redrawn after approval, so it reads proposed
			// again: re-approval refuses it too.
			const mockup = join(bench.root, ".indusk/mockups", APP, "screens/home.full.html");
			writeFileSync(mockup, `${readFileSync(mockup, "utf-8")}\n<!-- redrawn -->\n`);
			const reapproved = runCli(bench.root, ["plans", "reapprove", PLAN]);
			expect(reapproved.code, out(reapproved)).not.toBe(0);
			expect(out(reapproved)).toContain("home.full");
		} finally {
			bench.cleanup();
		}
	});
});

describe.skipIf(SHOULD_SKIP)("a look the brief names must be drawn", () => {
	it("A24 a plan whose brief names a look not drawn in its worktree is refused naming it, even with every drawn look approved", async () => {
		const brief = briefOf("looks-listed").replace(
			"1. **`home.full`**. The home screen with every seat shown.",
			"1. **`home.full`**. The home screen with every seat shown.\n2. **`seat.picker`**. A seat picker no one has drawn.",
		);
		expect(brief).toContain("seat.picker");
		app.writePlan({ brief, impl: "internal" });
		for (const look of ["home.full", "detail.default", "badge.ok"]) {
			const person = await approve(app.wt, APP, look, "sandy");
			expect(person.approved, JSON.stringify(person)).toBe(true);
		}
		const before = app.project.mainSha();

		const refused = runCli(app.trunk, ["plans", "approve", PLAN]);
		expect(refused.code, out(refused)).not.toBe(0);
		expect(out(refused)).toContain("seat.picker");
		expect(app.project.mainSha()).toBe(before);
	});
});

describe.skipIf(SHOULD_SKIP)("approval is of the brief", () => {
	it("A9 an approval records the hash of the brief approved, by whom and when, and the record does not follow an edit", () => {
		app.writePlan({ brief: "none", impl: "internal" });
		const brief = join(app.wt, PLAN_DIR, "brief.md");
		const approvedText = readFileSync(brief, "utf-8");

		const r = runCli(app.trunk, ["plans", "approve", PLAN]);
		expect(r.code, out(r)).toBe(0);

		const recorded = () =>
			matter(readFileSync(join(app.wt, PLAN_DIR, "impl.md"), "utf-8")).data as Record<
				string,
				unknown
			>;
		expect(recorded().approved_brief).toBe(sha256(approvedText));
		expect(typeof recorded().approved_by).toBe("string");
		expect(typeof recorded().approved_at).toBe("string");

		// A brief edited afterwards is a different brief from the one recorded: the
		// record holds the hash of what was approved, so the two read as changed.
		const edited = approvedText.replace("after two weeks", "after three weeks");
		writeFileSync(brief, edited);
		expect(edited).not.toBe(approvedText);
		expect(recorded().approved_brief).toBe(sha256(approvedText));
		expect(recorded().approved_brief).not.toBe(sha256(readFileSync(brief, "utf-8")));
	});
});

describe.skipIf(SHOULD_SKIP)("starting a plan from the terminal", () => {
	it("A23 `indusk plans start` makes the plan's branch, worktree and draft brief as before", () => {
		const r = runCli(app.trunk, ["plans", "start", "feature", "phone-nav"]);
		expect(r.code, out(r)).toBe(0);

		const wt = app.project.worktreeOf("phone-nav");
		expect(existsSync(wt), `no worktree at ${wt}`).toBe(true);
		expect(git(wt, ["branch", "--show-current"])).toBe("plan/phone-nav");
		const brief = matter(
			readFileSync(join(wt, ".indusk", "planning", "phone-nav", "brief.md"), "utf-8"),
		);
		expect(brief.data).toMatchObject({ status: "draft", workflow: "feature" });
	});
});
