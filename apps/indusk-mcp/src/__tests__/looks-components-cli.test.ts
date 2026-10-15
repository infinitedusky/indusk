import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { approve, withdraw } from "../lib/looks/approve.js";
import { readApp } from "../lib/looks/mockups.js";
import { readAppLooks } from "../lib/looks/overview.js";
import {
	app as copyOf,
	finding,
	lineOf,
	MOCKUPS,
	mockupFile,
	removeApps,
	run,
	statusLine,
} from "./helpers/looks-cli.js";

/**
 * storybook-components, Test Phase 1 — every row that reaches `indusk looks`
 * as a process, over a copy of `fixtures/components-app/`.
 *
 * promise: a-component-has-one-implementation — A1, A3.
 * promise: every-component-state-has-a-story — A4.
 * promise: a-mockup-composes-approved-components — A8, A9, A10.
 * promise: a-changed-component-reopens-its-mockups — A11.
 * promise: an-agent-can-find-every-component — A14.
 * promise: every-part-of-the-ui-is-covered — A15.
 * promise: a-mockup-is-approved-by-a-person — A16, A17, A27, A28 (a person takes an approval back).
 * promise: mockups-render-in-the-cockpit — A25 (a composed mockup carries its components' styles).
 * promise: a-changed-component-reopens-its-mockups — A26 (a changed style).
 * promise: a-mockup-is-approved-by-a-person — A31 (a story's approval binds its stylesheet).
 * promise: a-mockup-composes-approved-components — A32 (an Unapproved story reopens its mockups).
 * promise: a-component-has-one-implementation — A40 (a component a mockup names with none is reported).
 *
 * Each is red today on its own assertion: the commands run over the fixture
 * and the component lines below are absent. The output these rows read is the
 * contract Build Phases 2 and 3 build to (the fixture's `approved.json` and
 * `components.json` shapes are in `scripts/write-components-fixture.ts`):
 *
 *   lint      duplicate component <name>: <file>, <file>
 *             component markup outside its file: <file>:<line> <name>
 *             component drawn in mockup: <file>:<line> <name>
 *             no approved story: <name>.<state>     (at the mockup's file:line)
 *             needs a story: <name>                 (a component a mockup declares new)
 *             no story: <name>.<state>              (also in coverage)
 *             not in catalog: <name>                (also in coverage)
 *   status    story <name>.<state>  approved|proposed
 *             a mockup whose composed component changed reads
 *             `proposed  component changed: <name>`
 *   coverage  uncovered story: <name>.<state>
 *   approve   exit 2, naming the cockpit's Approve
 *   unapprove exit 2, naming the cockpit's Unapprove
 *   status    a withdrawn look reads `proposed  withdrawn by <name>`
 */

afterEach(removeApps);

const app = () => copyOf("components-app");
const sha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

/** The output lines containing every one of `parts`. */
const linesWith = (out: string, ...parts: string[]) =>
	out.split("\n").filter((l) => parts.every((p) => l.includes(p)));

/** The status line for a story, or an empty string so a missing line fails an assertion, not a type. */
function storyLine(out: string, story: string): string {
	const pattern = new RegExp(`^\\s*story ${story.replace(/\./g, "\\.")}\\s+(approved|proposed)\\b`);
	return out.split("\n").find((l) => pattern.test(l)) ?? "";
}

/** The copy as a git project, so the commit the writer makes can be read back. */
function project(): string {
	const root = app();
	const git = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf-8" });
	git("init", "-q", "-b", "main");
	git("config", "user.name", "Sandy Tester");
	git("config", "user.email", "sandy@example.com");
	git("add", "-A");
	git("commit", "-qm", "the components fixture");
	return root;
}

/** Replace a story's snapshot in the copy, as a changed component re-rendered would. */
function changeSnapshot(root: string, snapshot: string): void {
	const file = join(root, MOCKUPS, "components", `${snapshot}.html`);
	const before = readFileSync(file, "utf-8");
	writeFileSync(file, before.replace("var(--space-2)", "var(--space-3)"));
}

describe("a component has one implementation", () => {
	// A1
	it("A1 a component name marked on two implementations is refused, naming both files", () => {
		const root = app();
		const { out } = run(root, ["lint", "demo"]);
		const found = linesWith(out, "duplicate component", "badge");
		expect(found, out).not.toEqual([]);
		expect(found.join("\n")).toContain("src/Badge.jsx");
		expect(found.join("\n")).toContain("src/Other.jsx");
	});

	// A3
	it("A3 a screen that writes a component's marked element outside its file is refused, naming file and line", () => {
		const root = app();
		const line = lineOf(root, "src/Page.jsx", 'data-component="card"');
		const { out } = run(root, ["lint", "demo"]);
		const found = finding(out, "src/Page.jsx", line, "card").filter((l) =>
			l.includes("component markup outside its file"),
		);
		expect(found, out).not.toEqual([]);
		// Card.jsx is the card's own file and is not named.
		expect(out).not.toMatch(/component markup outside its file: src\/Card\.jsx/);
	});
});

describe("every component state has a story", () => {
	// A4
	it("A4 a state a mockup shows with no story is reported, naming the component and the state", () => {
		const root = app();
		for (const command of ["lint", "coverage"]) {
			const { out } = run(root, [command, "demo"]);
			expect(linesWith(out, "no story: badge.warn"), `${command}: ${out}`).not.toEqual([]);
			expect(out, `${command} names a state that has a story`).not.toMatch(/no story: badge\.ok/);
		}
	});
});

describe("a mockup composes approved components", () => {
	// A8
	it("A8 a mockup that draws a component's markup is refused, naming file, line and component", () => {
		const root = app();
		const file = mockupFile("home.empty");
		const line = lineOf(root, file, 'data-component="badge"');
		const { out } = run(root, ["lint", "demo"]);
		const found = finding(out, file, line, "badge").filter((l) =>
			l.includes("component drawn in mockup"),
		);
		expect(found, out).not.toEqual([]);
	});

	// A9
	it("A9 a component a mockup declares new passes the lint and is listed as needing a story", () => {
		const root = app();
		const file = mockupFile("home.new");
		const { out } = run(root, ["lint", "demo"]);
		expect(linesWith(out, "needs a story: pill"), out).not.toEqual([]);
		expect(
			linesWith(out, file, "component drawn in mockup"),
			"a declared new component is not drawn in the mockup unlawfully",
		).toEqual([]);
	});

	// A10
	it("A10 a mockup naming a component state with no approved story is refused, naming it", () => {
		const root = app();
		const file = mockupFile("home.missing");
		const line = lineOf(root, file, 'state="warn"');
		const { out } = run(root, ["lint", "demo"]);
		expect(finding(out, file, line, "no approved story: badge.warn"), out).not.toEqual([]);
		// home.default names badge.ok and card.default, both approved.
		expect(out).not.toMatch(/no approved story: badge\.ok/);
		expect(out).not.toMatch(/no approved story: card\.default/);
	});
});

describe("a changed component reopens its mockups", () => {
	// A11
	it("A11 a changed snapshot reopens the mockups that use it, naming it; the others stay approved", () => {
		const root = app();
		changeSnapshot(root, "badge.ok");
		const { out } = run(root, ["status", "demo"]);
		const home = statusLine(out, "home.default");
		expect(home, out).toMatch(/proposed/);
		expect(home).toContain("component changed: badge");
		// detail.default composes the card alone.
		expect(statusLine(out, "detail.default"), out).toMatch(/approved/);
	});
});

describe("a composed mockup carries its components' styles", () => {
	// A25
	it("A25 the document the cockpit frames holds each named component's rules, and the value check finds no raw value in them", async () => {
		const root = app();
		const looks = await readAppLooks(root, "demo");
		if ("problem" in looks) throw new Error(looks.problem);
		const home = looks.mockups.find((m) => m.name === "home.default");
		expect(home?.document).toContain(
			'[data-component="badge"] { letter-spacing: var(--space-1); }',
		);
		// detail.default composes the card alone: it takes no badge rule.
		const detail = looks.mockups.find((m) => m.name === "detail.default");
		expect(detail?.document).not.toContain('[data-component="badge"] {');
		const { out } = run(root, ["lint", "demo"]);
		expect(linesWith(out, "badge.css", "raw-value"), out).toEqual([]);
	});

	it("A25 a raw value in a component's stylesheet is a finding naming the file and the value", () => {
		const root = app();
		const file = join(root, MOCKUPS, "components", "badge.css");
		writeFileSync(file, '[data-component="badge"] { letter-spacing: 7px; }\n');
		const { out } = run(root, ["lint", "demo"]);
		expect(linesWith(out, "badge.css", "7px"), out.slice(0, 600)).not.toEqual([]);
	});
});

describe("a changed component style reopens its mockups", () => {
	// A26
	it("A26 a changed stylesheet reopens the mockups that use the component, naming it; the others stay approved", () => {
		const root = app();
		const file = join(root, MOCKUPS, "components", "badge.css");
		writeFileSync(file, readFileSync(file, "utf-8").replace("var(--space-1)", "var(--space-3)"));
		const { out } = run(root, ["status", "demo"]);
		const home = statusLine(out, "home.default");
		expect(home, out).toMatch(/proposed/);
		expect(home).toContain("component changed: badge");
		expect(statusLine(out, "detail.default"), out).toMatch(/approved/);
	});
});

describe("an agent can find every component", () => {
	// A14
	it("A14 a component implemented in the app and missing from the catalog is reported by name", () => {
		const root = app();
		for (const command of ["lint", "coverage"]) {
			const { out } = run(root, [command, "demo"]);
			expect(linesWith(out, "not in catalog: card"), `${command}: ${out}`).not.toEqual([]);
			expect(out, `${command} names a component the catalog lists`).not.toMatch(
				/not in catalog: badge/,
			);
		}
	});
});

describe("every part of the UI is covered", () => {
	// A15
	it("A15 a component state with no approved story is uncovered, and covered once approved", async () => {
		const root = app();
		const before = run(root, ["coverage", "demo"]).out;
		expect(linesWith(before, "uncovered story: badge.broken"), before).not.toEqual([]);
		expect(before, "an approved story is not uncovered").not.toMatch(/uncovered story: badge\.ok/);

		// A person's Approve, as the record holds it: the entry the fixture's script writes.
		const record = join(root, MOCKUPS, "approved.json");
		const held = JSON.parse(readFileSync(record, "utf-8")) as { approvals: unknown[] };
		const demo = await readApp(root, "demo");
		held.approvals.push({
			kind: "story",
			story: "badge.broken",
			snapshotHash: sha256(readFileSync(join(root, MOCKUPS, "components/badge.broken.html"))),
			stylesheetHash: sha256(readFileSync(join(root, MOCKUPS, "components/badge.css"))),
			foundationHash: demo.foundation.hash,
			declarationsHash: demo.declarationsHash,
			by: "sandy",
			at: "2026-10-12T10:00:00.000Z",
		});
		writeFileSync(record, JSON.stringify(held, null, "\t"));

		const after = run(root, ["coverage", "demo"]).out;
		expect(after, "an approved story is covered").not.toMatch(/uncovered story: badge\.broken/);
		// The record was read: the other stories are still approved, not reported.
		expect(after).not.toMatch(/uncovered story: badge\.ok/);
		expect(linesWith(after, "no story: badge.warn"), after).not.toEqual([]);
	});
	// A15 — a component no mockup names is covered by its stories.
	it("A15 a component no mockup names is covered once each of its stories is approved, and uncovered while one is not", async () => {
		const root = app();
		writeFileSync(
			join(root, "src/Tag.jsx"),
			'export const Tag = () => <span data-component="tag">tag</span>;\n',
		);
		const snapshot = readFileSync(join(root, MOCKUPS, "components/card.default.html"), "utf-8");
		writeFileSync(
			join(root, MOCKUPS, "components/tag.default.html"),
			snapshot.replace("card", "tag"),
		);
		const before = run(root, ["coverage", "demo"]).out;
		expect(linesWith(before, "uncovered component: tag"), before).not.toEqual([]);

		const record = join(root, MOCKUPS, "approved.json");
		const held = JSON.parse(readFileSync(record, "utf-8")) as { approvals: unknown[] };
		const demo = await readApp(root, "demo");
		held.approvals.push({
			kind: "story",
			story: "tag.default",
			snapshotHash: sha256(readFileSync(join(root, MOCKUPS, "components/tag.default.html"))),
			foundationHash: demo.foundation.hash,
			declarationsHash: demo.declarationsHash,
			by: "sandy",
			at: "2026-10-12T10:00:00.000Z",
		});
		writeFileSync(record, JSON.stringify(held, null, "\t"));

		const after = run(root, ["coverage", "demo"]).out;
		expect(after, "its approved story covers it").not.toMatch(/uncovered component: tag/);
		// badge has a story not approved: still uncovered by any means.
		expect(linesWith(after, "uncovered story: badge.broken"), after).not.toEqual([]);
	});
});

describe("a story is approved by a person", () => {
	// A16
	it("A16 a story reads proposed until a person approves it; the command line cannot approve", () => {
		const root = app();
		const { out } = run(root, ["status", "demo"]);
		expect(storyLine(out, "badge.ok"), out).toMatch(/approved/);
		expect(storyLine(out, "badge.broken"), out).toMatch(/proposed/);

		const record = join(root, MOCKUPS, "approved.json");
		const before = readFileSync(record, "utf-8");
		const refused = run(root, ["approve", "demo", "badge.broken"]);
		expect(refused.code).toBe(2);
		expect(refused.out).toMatch(/cockpit/i);
		expect(refused.out).toContain("Approve");
		expect(readFileSync(record, "utf-8"), "the refusal writes nothing").toBe(before);
	});

	// A17
	it("A17 a story changed after it was approved reads proposed again", () => {
		const root = app();
		expect(storyLine(run(root, ["status", "demo"]).out, "badge.ok")).toMatch(/approved/);
		changeSnapshot(root, "badge.ok");
		const { out } = run(root, ["status", "demo"]);
		expect(storyLine(out, "badge.ok"), out).toMatch(/proposed/);
		expect(storyLine(out, "card.default"), "an unchanged story stays approved").toMatch(/approved/);
	});
});

// Each case spawns the CLI several times; a loaded suite needs more than the default 5s.
describe("a person takes an approval back", { timeout: 30_000 }, () => {
	const lastCommitFiles = (root: string) =>
		execFileSync("git", ["show", "--name-only", "--format=", "HEAD"], {
			cwd: root,
			encoding: "utf-8",
		})
			.split("\n")
			.filter(Boolean);

	// A27
	it("A27 an Unapprove makes an approved mockup or story read proposed, withdrawn by them, keeps the history, leaves the others, and an Approve makes it approved again", async () => {
		const root = project();
		const record = join(root, MOCKUPS, "approved.json");
		const entries = () =>
			(JSON.parse(readFileSync(record, "utf-8")) as { approvals: unknown[] }).approvals;
		const before = entries();
		const held = await readApp(root, "demo");
		const home = held.mockups.find((m) => m.name === "home.default");
		const badge = held.stories.find((s) => s.name === "badge.ok");
		if (!home || !badge) throw new Error("the fixture has no home.default or badge.ok");
		const foundationHash = held.foundation.hash;

		// A mockup.
		const mockup = await withdraw(root, "demo", "home.default", "Sandy Tester", "mockup", {
			foundationHash,
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
		});
		expect(mockup.withdrawn, JSON.stringify(mockup)).toBe(true);
		let out = run(root, ["status", "demo"]).out;
		const line = statusLine(out, "home.default");
		expect(line, out).toMatch(/proposed/);
		expect(line).toContain("withdrawn by Sandy Tester");
		expect(line, "a withdrawn look is held to no reference").not.toContain("held to");
		expect(statusLine(out, "detail.default"), "the others stay approved").toMatch(/approved/);
		expect(storyLine(out, "badge.ok")).toMatch(/approved/);
		expect(lastCommitFiles(root), "only the record is committed").toEqual([
			`${MOCKUPS}/approved.json`,
		]);

		// The record keeps its history: what was there is still there, the withdrawal appended.
		const after = entries();
		expect(after.slice(0, before.length)).toEqual(before);
		expect(after.at(-1)).toMatchObject({
			kind: "withdrawn",
			subject: "mockup",
			name: "home.default",
			by: "Sandy Tester",
		});

		// A story.
		const story = await withdraw(root, "demo", "badge.ok", "Sandy Tester", "story", {
			foundationHash,
			snapshotHash: badge.hash,
		});
		expect(story.withdrawn, JSON.stringify(story)).toBe(true);
		out = run(root, ["status", "demo"]).out;
		expect(storyLine(out, "badge.ok"), out).toMatch(/proposed/);
		expect(storyLine(out, "badge.ok")).toContain("withdrawn by Sandy Tester");
		expect(storyLine(out, "card.default"), "an unwithdrawn story stays approved").toMatch(
			/approved/,
		);
		// Every reader goes through the same view: coverage reports it, the lint refuses what composes it.
		const coverage = run(root, ["coverage", "demo"]).out;
		expect(linesWith(coverage, "uncovered story: badge.ok"), coverage).not.toEqual([]);
		const lint = run(root, ["lint", "demo"]).out;
		expect(linesWith(lint, "no approved story: badge.ok"), lint.slice(0, 600)).not.toEqual([]);

		// Approving again reads approved: the later approval counts, the earlier one never did.
		const story2 = await approve(root, "demo", "badge.ok", "Sandy Tester", {
			kind: "story",
			snapshotHash: badge.hash,
			stylesheetHash: badge.stylesheetHash ?? undefined,
			foundationHash,
		});
		expect(story2.approved, JSON.stringify(story2)).toBe(true);
		const mockup2 = await approve(root, "demo", "home.default", "Sandy Tester", {
			foundationHash,
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
		});
		expect(mockup2.approved, JSON.stringify(mockup2)).toBe(true);
		out = run(root, ["status", "demo"]).out;
		expect(statusLine(out, "home.default"), out).toMatch(/approved/);
		expect(statusLine(out, "home.default")).not.toContain("withdrawn");
		expect(storyLine(out, "badge.ok"), out).toMatch(/approved/);
	});

	it("A27 withdrawing what is not approved, or what is not what was shown, is refused and writes nothing", async () => {
		const root = project();
		const record = join(root, MOCKUPS, "approved.json");
		const before = readFileSync(record, "utf-8");
		const held = await readApp(root, "demo");
		const broken = held.stories.find((s) => s.name === "badge.broken");
		const home = held.mockups.find((m) => m.name === "home.default");
		if (!broken || !home) throw new Error("the fixture has no badge.broken or home.default");
		const foundationHash = held.foundation.hash;

		const proposed = await withdraw(root, "demo", "badge.broken", "Sandy Tester", "story", {
			foundationHash,
			snapshotHash: broken.hash,
		});
		expect(proposed.withdrawn).toBe(false);
		expect(proposed.reason).toMatch(/not approved/);

		const stale = await withdraw(root, "demo", "home.default", "Sandy Tester", "mockup", {
			foundationHash,
			mockupHash: "0".repeat(64),
			componentsHash: home.componentsHash,
		});
		expect(stale.withdrawn).toBe(false);
		expect(stale.reason).toMatch(/not what was shown/);
		expect(readFileSync(record, "utf-8"), "a refusal writes nothing").toBe(before);
	});

	// A28
	it("A28 the command line's unapprove is refused, naming the cockpit's Unapprove, and writes nothing", () => {
		const root = app();
		const record = join(root, MOCKUPS, "approved.json");
		const before = readFileSync(record, "utf-8");
		for (const args of [
			["unapprove", "demo", "home.default"],
			["unapprove", "demo", "badge.ok"],
		]) {
			const refused = run(root, args);
			expect(refused.code, refused.out).toBe(2);
			expect(refused.out).toMatch(/cockpit/i);
			expect(refused.out).toContain("Unapprove");
		}
		expect(readFileSync(record, "utf-8"), "the refusal writes nothing").toBe(before);
	});
});

// Each case spawns the CLI and writes the record through the cockpit's writer.
describe("what a story's approval binds, and what keeps a mockup approved", {
	timeout: 30_000,
}, () => {
	// A31
	it("A31 a component whose stylesheet changes while its markup does not reads its stories proposed, and a mockup composing it is refused until the story is approved again", async () => {
		const root = project();
		const sheet = join(root, MOCKUPS, "components", "badge.css");
		writeFileSync(sheet, readFileSync(sheet, "utf-8").replace("var(--space-1)", "var(--space-3)"));
		const out = run(root, ["status", "demo"]).out;
		expect(storyLine(out, "badge.ok"), out).toMatch(/proposed/);
		expect(storyLine(out, "card.default"), "a story with no changed sheet stays approved").toMatch(
			/approved/,
		);

		const held = await readApp(root, "demo");
		const home = held.mockups.find((m) => m.name === "home.default");
		const badge = held.stories.find((s) => s.name === "badge.ok");
		if (!home || !badge) throw new Error("the fixture has no home.default or badge.ok");
		const foundationHash = held.foundation.hash;
		const shown = {
			foundationHash,
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
		};
		const refused = await approve(root, "demo", "home.default", "Sandy Tester", shown);
		expect(refused.approved, JSON.stringify(refused)).toBe(false);
		expect(refused.approved ? "" : refused.reason).toContain("badge.ok");

		const story = await approve(root, "demo", "badge.ok", "Sandy Tester", {
			kind: "story",
			snapshotHash: badge.hash,
			stylesheetHash: sha256(readFileSync(sheet)),
			foundationHash,
		});
		expect(story.approved, JSON.stringify(story)).toBe(true);
		const mockup = await approve(root, "demo", "home.default", "Sandy Tester", shown);
		expect(mockup.approved, JSON.stringify(mockup)).toBe(true);
		const after = run(root, ["status", "demo"]).out;
		expect(storyLine(after, "badge.ok"), after).toMatch(/approved/);
		expect(statusLine(after, "home.default"), after).toMatch(/approved/);
	});

	// A32
	it("A32 an approved mockup that composes a story a person has Unapproved reads proposed, naming that component, in status and coverage", async () => {
		const root = project();
		const held = await readApp(root, "demo");
		const badge = held.stories.find((s) => s.name === "badge.ok");
		if (!badge) throw new Error("the fixture has no badge.ok");
		const before = run(root, ["status", "demo"]).out;
		expect(statusLine(before, "home.default"), before).toMatch(/approved/);

		const taken = await withdraw(root, "demo", "badge.ok", "Sandy Tester", "story", {
			foundationHash: held.foundation.hash,
			snapshotHash: badge.hash,
		});
		expect(taken.withdrawn, JSON.stringify(taken)).toBe(true);

		const out = run(root, ["status", "demo"]).out;
		const home = statusLine(out, "home.default");
		expect(home, out).toMatch(/proposed/);
		expect(home).toContain("component changed: badge");
		// detail.default composes the card alone.
		expect(statusLine(out, "detail.default"), out).toMatch(/approved/);

		const coverage = run(root, ["coverage", "demo"]).out;
		expect(
			coverage
				.split("\n")
				.filter((l) => /uncovered (screen: home$|state: home\.default$)/.test(l.trim())),
			coverage,
		).not.toEqual([]);
		expect(linesWith(coverage, "uncovered story: badge.ok"), coverage).not.toEqual([]);
		// The lint already refuses it: the three readers agree.
		const lint = run(root, ["lint", "demo"]).out;
		expect(linesWith(lint, "no approved story: badge.ok"), lint.slice(0, 600)).not.toEqual([]);
	});
});

describe("a component a mockup names with no implementation is reported", () => {
	// A40
	it("A40 coverage prints `unimplemented component: ghost` for a mockup naming a component no file marks, and exits 1", () => {
		const root = app();
		writeFileSync(
			join(root, MOCKUPS, "screens/home.ghost.html"),
			'<!doctype html>\n<html lang="en"><head><meta charset="utf-8" /><title>home — ghost</title></head>\n<body><span data-component="ghost">boo</span></body></html>\n',
		);
		const { code, out } = run(root, ["coverage", "demo"]);
		expect(linesWith(out, "unimplemented component: ghost"), out).not.toEqual([]);
		expect(code).toBe(1);
		// badge and card are marked in src/, so they are not reported.
		expect(out).not.toMatch(/unimplemented component: (badge|card)\b/);
	});
});
