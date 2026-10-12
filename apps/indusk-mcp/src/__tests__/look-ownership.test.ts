import { cpSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../lib/bookkeeping/fixture.test-support.js";
import { readApprovals } from "../lib/looks/approvals.js";
import { approve } from "../lib/looks/approve.js";
import { readApp } from "../lib/looks/mockups.js";

/**
 * promise: a-look-has-the-plan-that-owns-it — brief-as-the-contract A4.
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
