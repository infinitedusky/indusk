import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readApp } from "../lib/looks/mockups.js";
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
 * promise: a-mockup-is-approved-by-a-person — A16, A17.
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
