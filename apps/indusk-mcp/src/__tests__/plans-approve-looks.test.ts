import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approve } from "../lib/looks/approve.js";
import { APP, type BriefAppProject, briefAppProject, PLAN, PLAN_DIR } from "./helpers/brief-app.js";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";

/**
 * promise: a-plan-is-approved-with-its-looks-approved — brief-as-the-contract A8.
 * promise: approval-is-of-the-brief — brief-as-the-contract A9.
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

		const person = await approve(app.wt, APP, "home.full", "sandy");
		expect(person.approved, JSON.stringify(person)).toBe(true);
		const approved = runCli(app.trunk, ["plans", "approve", PLAN]);
		expect(approved.code, out(approved)).toBe(0);
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
