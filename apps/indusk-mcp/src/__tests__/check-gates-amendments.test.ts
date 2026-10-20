import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	type BriefAppProject,
	briefAppProject,
	implOf,
	PLAN,
	PLAN_DIR,
} from "./helpers/brief-app.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
import { briefText } from "./helpers/plan-fixture.js";
import { DOMAIN } from "./helpers/plan-lifecycle-fixture.js";
import { approveWithReview } from "./helpers/plan-review-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";

/**
 * promise: a-change-to-what-was-agreed-needs-the-person — brief-as-the-contract A35.
 * promise: a-plan-builds-only-after-approval — cockpit-redraw A12: the amendment clause.
 *
 * The amendment gate cannot be stepped past from the impl: a `<!-- skip-gates -->`
 * marker does not let a build item be checked off while an amendment waits, and
 * an edit that removes `approved_brief:` from an approved plan's impl is
 * refused (the field changes only through `indusk plans reapprove`, a CLI
 * write that passes no hook). Driven as A11 and A12 are: a plan approved
 * through `indusk plans approve`, and `check-gates.js` spawned for the edit.
 */

const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const AMENDED = "A held seat is released at once when its hold runs out.";
const ITEM = "- [ ] release the seat when its hold runs out";

let app: BriefAppProject;
let impl: string;

const writePromiseWith = (statement: string) =>
	writePromise(join(app.wt, ".indusk", "promises"), {
		name: NAME,
		kind: "state",
		state: "declared",
		domain: DOMAIN,
		owner: PLAN,
		statement,
	});
const brief = (sentence: string) =>
	briefText(PLAN, {
		expectations: [{ text: "People seat themselves", measure: "seats taken per day", look: "x" }],
		makes: [{ name: NAME, sentence }],
	});

beforeEach(() => {
	app = briefAppProject("check-gates-amendments");
	impl = join(app.wt, PLAN_DIR, "impl.md");
	writePromiseWith(SENTENCE);
	app.writePlan({ brief: brief(SENTENCE), impl: implOf("internal") });
	const approved = approveWithReview(app.trunk, PLAN, join(app.wt, PLAN_DIR));
	expect(approved.code, `${approved.stdout}\n${approved.stderr}`).toBe(0);
});
afterEach(() => app.cleanup());

const edit = (oldString: string, newString: string) =>
	runHook(
		"check-gates.js",
		{
			tool_name: "Edit",
			tool_input: { file_path: impl, old_string: oldString, new_string: newString },
			cwd: app.wt,
		},
		{ cwd: app.wt },
	);

describe.skipIf(SHOULD_SKIP)("the amendment gate cannot be stepped past from the impl", () => {
	it("A35 a skip-gates marker does not let a build item be checked off while an amendment waits", async () => {
		writePromiseWith(AMENDED);
		writeFileSync(join(app.wt, PLAN_DIR, "brief.md"), brief(AMENDED));

		const r = await edit(ITEM, `${ITEM.replace("- [ ]", "- [x]")} <!-- skip-gates -->`);

		expect(r.exitCode, r.stderr).toBe(2);
		expect(r.stderr).toContain(AMENDED);
	});

	it("A35 an edit that removes approved_brief from an approved plan's impl is refused, naming the command that changes it", async () => {
		const text = readFileSync(impl, "utf-8");
		const line = /^approved_brief:.*\n/m.exec(text)?.[0];
		expect(line, "the approved impl records approved_brief").toBeDefined();

		const removed = await edit(line as string, "");
		expect(removed.exitCode, removed.stderr).toBe(2);
		expect(removed.stderr).toContain("indusk plans reapprove");

		const changed = await edit(line as string, `approved_brief: ${"0".repeat(64)}\n`);
		expect(changed.exitCode, changed.stderr).toBe(2);
		expect(changed.stderr).toContain("indusk plans reapprove");
	});
});
