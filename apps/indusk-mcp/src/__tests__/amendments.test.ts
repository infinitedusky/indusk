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
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { runHook } from "./helpers/hook-runner.js";
import { briefText } from "./helpers/plan-fixture.js";
import { DOMAIN } from "./helpers/plan-lifecycle-fixture.js";
import { writePromise } from "./helpers/promises-fixture.js";

/**
 * promise: a-change-to-what-was-agreed-needs-the-person — brief-as-the-contract
 * A11, A12 (and the guard A14: a change to an impl item, a note or a Shape
 * finding waits for nobody).
 *
 * A promise's statement, an expectation or a look changed after approval is an
 * amendment: the build does not go on until a person approves it. Reached over
 * what exists today: a plan approved through `indusk plans approve` in the
 * `brief-app` fixture, its brief edited, and `check-gates.js` spawned to check
 * a build item off — the gate every build passes through.
 */

const NAME = "seat-released-on-timeout";
const SENTENCE = "A held seat is released when its hold runs out.";
const EXPECTATION = "People seat themselves";
const ITEM = "- [ ] release the seat when its hold runs out";
const LESSON = "lesson: a-plan-builds-only-after-approval";

const LOOKS = [
	"",
	"## Looks",
	"",
	"### This plan makes",
	"",
	"None.",
	"",
	"### Existing looks",
	"",
	"**Must not break**",
	"",
	"- **`home.empty`**. Stays as approved.",
	"",
	"**Changes**",
	"",
	"None.",
	"",
	"**Replaces**",
	"",
	"None.",
	"",
].join("\n");

const brief = (opts: { sentence?: string; expectation?: string; looks?: string } = {}) =>
	briefText(PLAN, {
		expectations: [
			{
				text: opts.expectation ?? EXPECTATION,
				measure: "seats taken per day",
				look: "in two weeks",
			},
		],
		makes: [{ name: NAME, sentence: opts.sentence ?? SENTENCE }],
	}) + (opts.looks ?? LOOKS);

let app: BriefAppProject;
let impl: string;
beforeEach(() => {
	app = briefAppProject("amendments");
	impl = join(app.wt, PLAN_DIR, "impl.md");
	writePromiseWith(SENTENCE);
	app.writePlan({ brief: brief(), impl: implOf("internal") });
	const approved = runCli(app.trunk, ["plans", "approve", PLAN]);
	expect(approved.code, `${approved.stdout}\n${approved.stderr}`).toBe(0);
});
afterEach(() => app.cleanup());

function writePromiseWith(statement: string): void {
	writePromise(join(app.wt, ".indusk", "promises"), {
		name: NAME,
		kind: "state",
		state: "declared",
		domain: DOMAIN,
		owner: PLAN,
		statement,
	});
}

const writeBrief = (text: string) => writeFileSync(join(app.wt, PLAN_DIR, "brief.md"), text);

/** The gate, asked to let a build item be checked off in the plan's worktree. */
const checkOff = (item = ITEM) =>
	runHook(
		"check-gates.js",
		{
			tool_name: "Edit",
			tool_input: {
				file_path: impl,
				old_string: item,
				new_string: item.replace("- [ ]", "- [x]"),
			},
			cwd: app.wt,
		},
		{ cwd: app.wt },
	);

const amendments: Array<{
	part: string;
	was: string;
	now: string;
	amend: (now: string) => void;
}> = [
	{
		part: "a promise's statement",
		was: SENTENCE,
		now: "A held seat is released at once when its hold runs out.",
		amend: (now) => {
			writePromiseWith(now);
			writeBrief(brief({ sentence: now }));
		},
	},
	{
		part: "an expectation",
		was: EXPECTATION,
		now: "Seats are taken without staff",
		amend: (now) => writeBrief(brief({ expectation: now })),
	},
	{
		part: "a look",
		was: "None.",
		now: "home.full",
		amend: (now) =>
			writeBrief(
				brief({
					looks: LOOKS.replace(
						"### This plan makes\n\nNone.",
						`### This plan makes\n\n1. **\`${now}\`**. The home screen with every seat shown.`,
					),
				}),
			),
	},
];

describe.skipIf(SHOULD_SKIP)("an amendment waits for the person", () => {
	for (const { part, was, now, amend } of amendments) {
		it(`A11 ${part} changed after approval is named as waiting, with what it was and what it is now`, async () => {
			amend(now);
			const r = await checkOff();
			expect(r.exitCode, r.stderr).toBe(2);
			expect(r.stderr).toContain(now);
			if (was !== "None.") expect(r.stderr).toContain(was);
		});
	}

	it("A12 while an amendment waits no build item is checked off; once the person approves it the build goes on and the review shows both versions", async () => {
		const now = "A held seat is released at once when its hold runs out.";
		writePromiseWith(now);
		writeBrief(brief({ sentence: now }));

		const waiting = await checkOff();
		expect(waiting.exitCode, waiting.stderr).toBe(2);
		expect(waiting.stderr).toContain(LESSON);

		const reapproved = runCli(app.trunk, ["plans", "reapprove", PLAN]);
		expect(reapproved.code, `${reapproved.stdout}\n${reapproved.stderr}`).toBe(0);

		const goingOn = await checkOff();
		expect(goingOn.exitCode, goingOn.stderr).toBe(0);

		const review = runCli(app.trunk, ["plans", "review", PLAN, "--json"]);
		expect(review.code, review.stderr).toBe(0);
		expect(review.stdout).toContain(SENTENCE);
		expect(review.stdout).toContain(now);
	});
});

describe.skipIf(SHOULD_SKIP)("a change that is not an amendment", () => {
	it("A14 an impl item reworded, a note added and an item checked off with a note after approval wait for nobody", async () => {
		const reworded = "- [ ] release the seat when its hold runs out, from a monotonic clock";
		const reword = await runHook(
			"check-gates.js",
			{
				tool_name: "Edit",
				tool_input: { file_path: impl, old_string: ITEM, new_string: reworded },
				cwd: app.wt,
			},
			{ cwd: app.wt },
		);
		expect(reword.exitCode, reword.stderr).toBe(0);
		writeFileSync(impl, readFileSync(impl, "utf-8").replace(ITEM, reworded));

		const note =
			"- [x] release the seat when its hold runs out, from a monotonic clock\n  - Note: the timer reads the monotonic clock, not the wall clock";
		const checked = await runHook(
			"check-gates.js",
			{
				tool_name: "Edit",
				tool_input: { file_path: impl, old_string: reworded, new_string: note },
				cwd: app.wt,
			},
			{ cwd: app.wt },
		);
		expect(checked.exitCode, checked.stderr).toBe(0);
		writeFileSync(impl, readFileSync(impl, "utf-8").replace(reworded, note));
		expect(readFileSync(impl, "utf-8")).toContain("the timer reads the monotonic clock");
	});
});
