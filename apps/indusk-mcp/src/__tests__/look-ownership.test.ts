import { appendFileSync, cpSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../lib/bookkeeping/fixture.test-support.js";
import { approvalOf, readApprovals } from "../lib/looks/approvals.js";
import { approve } from "../lib/looks/approve.js";
import { readApp } from "../lib/looks/mockups.js";

/**
 * promise: a-look-has-the-plan-that-owns-it — brief-as-the-contract A4.
 * promise: a-changed-look-keeps-its-history — brief-as-the-contract A6, a
 * regression guard: a redrawn approved look reads proposed while the version a
 * person approved stays the reference the app is held to.
 *
 * A look approved in a plan's checkout records the plan that checkout is on,
 * and reading the approval shows it. The writer is the one the cockpit's
 * Approve calls, given a plan's worktree (on `plan/x`) over the `brief-app`
 * fixture's app.
 */

const FIXTURE_APP = join(__dirname, "fixtures", "brief-app", "app");

let f: Fixture;
beforeEach(() => {
	f = makeFixture();
	cpSync(FIXTURE_APP, f.main, { recursive: true });
	f.git(f.main, "add", "-A");
	f.git(f.main, "commit", "-qm", "the brief-app fixture's app");
	f.git(f.worktree, "merge", "-q", "main");
});
afterEach(() => f.cleanup());

describe("A4 a look approved in a plan's checkout records that plan", () => {
	it("the entry the approval appends names the plan the checkout is on", async () => {
		const r = await approve(f.worktree, "demo", "home.full", "sandy");
		expect(r.approved, JSON.stringify(r)).toBe(true);

		const app = await readApp(f.worktree, "demo");
		const entry = readApprovals(app)
			.filter((e) => e.mockup === "home.full")
			.at(-1) as { by: string; plan?: string } | undefined;
		expect(entry?.by).toBe("sandy");
		expect(entry?.plan).toBe("x");
	});
});

describe("A6 a redrawn look is proposed while the approved version is still the reference", () => {
	it("an approved look whose mockup changes reads proposed, holding its approved entry as the reference", async () => {
		const read = async () => {
			const app = await readApp(f.worktree, "demo");
			const mockup = app.mockups.find((m) => m.name === "home.empty");
			if (!mockup) throw new Error("the fixture has no home.empty");
			return { entries: readApprovals(app), status: approvalOf(app, mockup, readApprovals(app)) };
		};

		const before = await read();
		expect(before.status.state).toBe("approved");

		appendFileSync(
			join(f.worktree, ".indusk/mockups/demo/screens/home.empty.html"),
			"<!-- redrawn -->\n",
		);

		const after = await read();
		expect(after.status.state).toBe("proposed");
		const reference = after.status.state === "proposed" ? after.status.reference : null;
		expect(reference?.mockupHash).toBe(
			before.status.state === "approved" ? before.status.entry.mockupHash : "",
		);
		expect(after.entries).toEqual(before.entries);
	});
});
