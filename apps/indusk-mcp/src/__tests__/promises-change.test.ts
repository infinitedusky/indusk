import { readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { runCli, SHOULD_SKIP } from "./helpers/cli.js";
import { briefText, implText } from "./helpers/plan-fixture.js";
import {
	daysAgo,
	type PromiseProject,
	promiseProject,
	siteFile,
	testFile,
} from "./helpers/promises-fixture.js";

/**
 * promise: a-changed-promise-keeps-its-history — planner-promises A25, A26.
 *
 * A later plan that affects a promise either improves it in place or replaces
 * it. Improved, it stays one promise — same name and file — so its incidents
 * and the marks that name it stay attached; the plan that changed it takes it
 * over, and its History keeps the old sentence, the reason and the plan that
 * owned it before. Replaced, the old one is retired when the new plan closes
 * and the new one records which it replaced. Through the CLI.
 */

const OLD_PLAN = "seats-v1";
const PLAN = "seats-v2";
const NAME = "seat-never-double-booked";
const OLD_SENTENCE = "A seat is never held by two players at once.";
const NEW_SENTENCE =
	"A seat is never held by two players at once, and a hold lasts at most two minutes.";
const REASON = "holds are now timed";
const INCIDENT = "i-2026-09-17-seat-never-double-booked";
const TEST = "src/seat.test.ts";
const SITE = "src/seat.ts";
const NEW_NAME = "seat-held-with-timeout";
const NEW_STATEMENT = "A seat is held for at most two minutes, by one player.";

let fixture: PromiseProject | null = null;
afterEach(() => {
	if (fixture) rmSync(fixture.root, { recursive: true, force: true });
	fixture = null;
});

/** `seats-v1` landed holding the promise; `seats-v2` is the plan now changing or replacing it. */
function project(brief: Parameters<typeof briefText>[1], forCell: string): PromiseProject {
	fixture = promiseProject({
		domains: ["seating"],
		landed: { [OLD_PLAN]: daysAgo(30) },
		promises: [
			{
				name: NAME,
				kind: "state",
				state: "enforced",
				domain: "seating",
				owner: OLD_PLAN,
				statement: OLD_SENTENCE,
				sites: [SITE],
				tests: [TEST],
				incidents: [INCIDENT],
			},
		],
		incidents: [
			{
				id: INCIDENT,
				promise: NAME,
				source: "local",
				status: "fixed",
				opened: "2026-09-17T10:00:00Z",
				fixed: "2026-09-18T10:00:00Z",
				rootCause: "Two statements held the seat.",
			},
		],
		planFiles: {
			[`${PLAN}/brief.md`]: briefText(PLAN, brief),
			[`${PLAN}/impl.md`]: implText(PLAN, {
				keys: ["test_purpose: required"],
				columns: ["For", "Test"],
				rows: [{ cells: { For: forCell, Test: TEST } }],
			}),
		},
		files: { [SITE]: siteFile(NAME), [TEST]: testFile(NAME) },
	});
	return fixture;
}

const read = (p: PromiseProject, name: string) =>
	matter(readFileSync(join(p.planRoot, ".indusk", "promises", `${name}.md`), "utf-8"));

describe.skipIf(SHOULD_SKIP)("A25 — a changed promise keeps its name and its history", () => {
	const changing = () =>
		project({ changes: [{ name: NAME, sentence: NEW_SENTENCE }] }, `promise: ${NAME}`);
	const change = (p: PromiseProject, name = NAME) =>
		runCli(p.root, [
			"promises",
			"change",
			name,
			"--plan",
			PLAN,
			"--statement",
			NEW_SENTENCE,
			"--reason",
			REASON,
		]);

	it("has its new sentence, is owned by the changing plan, and its History says what it was and whose", () => {
		const p = changing();
		const before = runCli(p.root, ["promises", "check"]);
		expect(before.code, `precondition — the registry is clean:\n${before.stderr}`).toBe(0);
		const r = change(p);
		expect(r.code, r.stdout + r.stderr).toBe(0);

		const file = read(p, NAME);
		expect(file.content.trim().split("\n")[0]).toBe(NEW_SENTENCE);
		expect(file.data.owner).toBe(PLAN);
		expect(file.data.state, "a change does not unprove it").toBe("enforced");
		expect(file.data.incidents, "its incidents stay with it").toEqual([INCIDENT]);
		const history = file.content.slice(file.content.indexOf("## History"));
		expect(history).toContain(OLD_SENTENCE);
		expect(history).toContain(REASON);
		expect(history).toContain(OLD_PLAN);
		expect(history).toContain(PLAN);
		expect(history, "what was there before is kept").toContain("registered");
	});

	it("when the changing plan closes, the registry check passes: its marks and incidents still resolve", () => {
		const p = changing();
		expect(change(p).code).toBe(0);
		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(0);
		const check = runCli(p.root, ["promises", "check"]);
		expect(check.code, check.stderr).toBe(0);
		expect(read(p, NAME).data).toMatchObject({ owner: PLAN, state: "enforced", tests: [TEST] });
	});

	it("the plan cannot close while the change its brief lists was never made, naming the promise", () => {
		const p = changing();
		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(2);
		expect(confirm.stderr).toContain(NAME);
		expect(confirm.stderr).toMatch(/never made/);
		expect(read(p, NAME).data.owner, "nothing written").toBe(OLD_PLAN);
	});

	it("refuses a promise the registry does not hold, naming it", () => {
		const p = changing();
		const r = change(p, "seat-map-never-stale");
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain("seat-map-never-stale");
	});
});

describe.skipIf(SHOULD_SKIP)("A26 — a replaced promise is retired when the new plan closes", () => {
	const replacing = () =>
		project(
			{
				makes: [{ name: NEW_NAME, sentence: NEW_STATEMENT }],
				replaces: [{ old: NAME, by: NEW_NAME }],
			},
			`promise: ${NEW_NAME}`,
		);
	const replace = (p: PromiseProject, old = NAME) =>
		runCli(p.root, [
			"promises",
			"replace",
			old,
			"--by",
			NEW_NAME,
			"--plan",
			PLAN,
			"--kind",
			"state",
			"--domain",
			"seating",
			"--statement",
			NEW_STATEMENT,
		]);

	it("declares the new promise recording which it replaces, and leaves the old one in force until then", () => {
		const p = replacing();
		const r = replace(p);
		expect(r.code, r.stdout + r.stderr).toBe(0);
		expect(read(p, NEW_NAME).data).toMatchObject({
			state: "declared",
			owner: PLAN,
			supersedes: NAME,
		});
		expect(read(p, NAME).data.state, "still in force while the plan builds").toBe("enforced");
	});

	it("at close the old one is retired, the new one is enforced, and the check passes", () => {
		const p = replacing();
		expect(replace(p).code).toBe(0);
		// The plan's work: the code and its test now name the new promise.
		writeFileSync(join(p.codeRoot, SITE), siteFile(NEW_NAME));
		writeFileSync(join(p.codeRoot, TEST), testFile(NEW_NAME));

		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(0);
		expect(read(p, NAME).data.state).toBe("retired");
		expect(read(p, NEW_NAME).data).toMatchObject({ state: "enforced", supersedes: NAME });
		const check = runCli(p.root, ["promises", "check"]);
		expect(check.code, check.stderr).toBe(0);
	});

	it("the plan cannot close while code still names the promise being replaced, naming the file", () => {
		const p = replacing();
		expect(replace(p).code).toBe(0);
		// The test moved to the new promise; the code site was forgotten.
		writeFileSync(join(p.codeRoot, TEST), testFile(NEW_NAME));
		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(2);
		expect(confirm.stderr).toContain(SITE);
		expect(confirm.stderr).toContain(NAME);
		expect(read(p, NAME).data.state, "nothing written: the old one is still in force").toBe(
			"enforced",
		);
		expect(read(p, NEW_NAME).data.state).toBe("declared");
	});

	it("the plan cannot close while the replacement was declared as a plain new promise", () => {
		const p = replacing();
		const declared = runCli(p.root, [
			"promises",
			"declare",
			NEW_NAME,
			"--plan",
			PLAN,
			"--kind",
			"state",
			"--domain",
			"seating",
			"--statement",
			NEW_STATEMENT,
		]);
		expect(declared.code, declared.stdout + declared.stderr).toBe(0);
		writeFileSync(join(p.codeRoot, SITE), siteFile(NEW_NAME));
		writeFileSync(join(p.codeRoot, TEST), testFile(NEW_NAME));
		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(2);
		expect(confirm.stderr).toContain(NAME);
		expect(confirm.stderr).toMatch(/promises replace/);
		expect(read(p, NEW_NAME).data.state, "nothing written").toBe("declared");
	});

	it("refuses to replace a promise that does not exist, naming it", () => {
		const p = replacing();
		const r = replace(p, "seat-map-never-stale");
		expect(r.code, r.stdout + r.stderr).toBe(2);
		expect(r.stderr).toContain("seat-map-never-stale");
	});
});

/**
 * planner-promises A38 — `replace` records the link on a replacement already
 * declared. Following the planner's steps a replacement can be declared
 * plainly first; confirm then refuses and names `promises replace`, which
 * refused because the name was already taken.
 */
describe.skipIf(SHOULD_SKIP)(
	"A38 — a replacement declared plainly can still be recorded as one",
	() => {
		it("replace records supersedes on it, and the plan then closes with the old one retired", () => {
			const p = project(
				{
					makes: [{ name: NEW_NAME, sentence: NEW_STATEMENT }],
					replaces: [{ old: NAME, by: NEW_NAME }],
				},
				`promise: ${NEW_NAME}`,
			);
			const declared = runCli(p.root, [
				"promises",
				"declare",
				NEW_NAME,
				"--plan",
				PLAN,
				"--kind",
				"state",
				"--domain",
				"seating",
				"--statement",
				NEW_STATEMENT,
			]);
			expect(declared.code, declared.stdout + declared.stderr).toBe(0);
			const r = runCli(p.root, [
				"promises",
				"replace",
				NAME,
				"--by",
				NEW_NAME,
				"--plan",
				PLAN,
				"--kind",
				"state",
				"--domain",
				"seating",
				"--statement",
				NEW_STATEMENT,
			]);
			expect(r.code, r.stdout + r.stderr).toBe(0);
			expect(read(p, NEW_NAME).data.supersedes).toBe(NAME);

			writeFileSync(join(p.codeRoot, SITE), siteFile(NEW_NAME));
			writeFileSync(join(p.codeRoot, TEST), testFile(NEW_NAME));
			const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
			expect(confirm.code, confirm.stdout + confirm.stderr).toBe(0);
			expect(read(p, NAME).data.state).toBe("retired");
		});
	},
);

/**
 * planner-promises A40 — confirm keeps an in-force promise's links true. A
 * plan that changes a promise and moves its test: confirm wrote only declared
 * promises, so the moved test was never listed, the old path stayed, and the
 * registry check refused a file that no longer exists.
 */
describe.skipIf(SHOULD_SKIP)("A40 — a changed promise whose test moved closes by command", () => {
	it("confirm lists the test that exists now, and the registry check passes", () => {
		const MOVED = "src/seat-hold.test.ts";
		const p = project({ changes: [{ name: NAME, sentence: NEW_SENTENCE }] }, `promise: ${NAME}`);
		const changed = runCli(p.root, [
			"promises",
			"change",
			NAME,
			"--plan",
			PLAN,
			"--statement",
			NEW_SENTENCE,
			"--reason",
			REASON,
		]);
		expect(changed.code, changed.stdout + changed.stderr).toBe(0);
		// The plan's work: the test moved, and the plan's row names where it went.
		unlinkSync(join(p.codeRoot, TEST));
		writeFileSync(join(p.codeRoot, MOVED), testFile(NAME));
		const implPath = join(p.planRoot, ".indusk", "planning", PLAN, "impl.md");
		writeFileSync(implPath, readFileSync(implPath, "utf-8").replace(`| ${TEST} |`, `| ${MOVED} |`));

		const confirm = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(confirm.code, confirm.stdout + confirm.stderr).toBe(0);
		expect(read(p, NAME).data.tests).toEqual([MOVED]);
		const check = runCli(p.root, ["promises", "check"]);
		expect(check.code, check.stderr).toBe(0);
	});
});

/**
 * planner-promises A42 — confirm run again finishes what it started. It
 * enforced a replacement before retiring what it replaced, and wrote only
 * declared promises, so a run stopped between the two writes left both in
 * force and a second run did nothing.
 */
describe.skipIf(SHOULD_SKIP)("A42 — a confirm stopped between its two writes", () => {
	it("a second run retires the promise the enforced replacement replaced", () => {
		const p = project(
			{
				makes: [{ name: NEW_NAME, sentence: NEW_STATEMENT }],
				replaces: [{ old: NAME, by: NEW_NAME }],
			},
			`promise: ${NEW_NAME}`,
		);
		const replaced = runCli(p.root, [
			"promises",
			"replace",
			NAME,
			"--by",
			NEW_NAME,
			"--plan",
			PLAN,
			"--kind",
			"state",
			"--domain",
			"seating",
			"--statement",
			NEW_STATEMENT,
		]);
		expect(replaced.code, replaced.stdout + replaced.stderr).toBe(0);
		writeFileSync(join(p.codeRoot, SITE), siteFile(NEW_NAME));
		writeFileSync(join(p.codeRoot, TEST), testFile(NEW_NAME));
		// The state the first run left: the replacement enforced, the old one still in force.
		const newPath = join(p.planRoot, ".indusk", "promises", `${NEW_NAME}.md`);
		writeFileSync(
			newPath,
			readFileSync(newPath, "utf-8")
				.replace("state: declared", "state: enforced")
				.replace("sites: []", `sites:\n  - ${SITE}`)
				.replace("tests: []", `tests:\n  - ${TEST}`),
		);
		expect(read(p, NAME).data.state).toBe("enforced");

		const again = runCli(p.root, ["promises", "confirm", PLAN]);
		expect(again.code, again.stdout + again.stderr).toBe(0);
		expect(read(p, NAME).data.state).toBe("retired");
	});
});
