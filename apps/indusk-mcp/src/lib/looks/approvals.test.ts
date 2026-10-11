import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { approvalOf, approve, readApprovals } from "./approvals.js";
import { LooksAppError, readApp } from "./mockups.js";

/**
 * promise: a-mockup-is-approved-by-a-person — ui-promises A3, A4 (the record's
 * reading) and the writer the cockpit's Approve calls (A2 drives it through
 * the admin in Build Phase 4).
 *
 * The fixture app is copied into a main checkout with a plan worktree beside
 * it, so `approve` is seen writing and committing on `main` from either.
 */

const FIXTURE = join(__dirname, "..", "..", "__tests__", "fixtures", "looks-app");
const RECORD = ".indusk/mockups/demo/approved.json";

let f: Fixture;
beforeEach(() => {
	f = makeFixture();
	cpSync(FIXTURE, f.main, { recursive: true });
	f.git(f.main, "add", "-A");
	f.git(f.main, "commit", "-qm", "the looks fixture");
});
afterEach(() => f.cleanup());

const mockupOf = async (name: string) => {
	const app = await readApp(f.main, "demo");
	const mockup = app.mockups.find((m) => m.name === name);
	if (!mockup) throw new Error(`no mockup ${name}`);
	return { app, mockup };
};

describe("approvalOf — bound to the mockup's hash and the foundation's", () => {
	it("an entry holding both current hashes reads approved; a stale hash reads proposed with that entry as reference", async () => {
		const empty = await mockupOf("home.empty");
		expect(approvalOf(empty.app, empty.mockup, readApprovals(empty.app)).state).toBe("approved");

		const full = await mockupOf("home.full");
		const status = approvalOf(full.app, full.mockup, readApprovals(full.app));
		expect(status.state).toBe("proposed");
		expect(status.state === "proposed" && status.reference?.mockupHash).toMatch(/^0{64}$/);

		const detail = await mockupOf("detail.default");
		expect(approvalOf(detail.app, detail.mockup, readApprovals(detail.app))).toEqual({
			state: "proposed",
			reference: null,
		});
	});

	it("a record that is not a list of entries is refused, never read as empty", async () => {
		writeFileSync(join(f.main, RECORD), JSON.stringify({ approvals: [{ mockup: "home.empty" }] }));
		const app = await readApp(f.main, "demo");
		expect(() => readApprovals(app)).toThrow(LooksAppError);
	});
});

describe("approve — the cockpit's writer", () => {
	it("appends an entry bound to the current hashes and commits only the record on main, from a worktree", async () => {
		writeFileSync(join(f.main, "staged.txt"), "a person's work\n");
		f.git(f.main, "add", "staged.txt");

		const r = await approve(f.worktree, "demo", "home.full", "sandy");
		expect(r.approved).toBe(true);

		const { app, mockup } = await mockupOf("home.full");
		expect(approvalOf(app, mockup, readApprovals(app)).state).toBe("approved");
		const entries = JSON.parse(readFileSync(join(f.main, RECORD), "utf-8")).approvals;
		expect(entries.at(-1)).toMatchObject({
			mockup: "home.full",
			mockupHash: mockup.hash,
			foundationHash: app.foundation.hash,
			by: "sandy",
		});
		expect(f.git(f.main, "log", "-1", "--format=%s", "main")).toMatch(/^chore\(indusk\): looks — /);
		expect(f.git(f.main, "show", "--name-only", "--format=", "main")).toBe(RECORD);
		// What the person had staged stays staged, out of the commit.
		expect(f.git(f.main, "status", "--porcelain")).toBe("A  staged.txt");
	});

	it("gives a mockup already approved as it is no second entry", async () => {
		const before = readFileSync(join(f.main, RECORD), "utf-8");
		const r = await approve(f.main, "demo", "home.empty", "sandy");
		expect(r.approved).toBe(true);
		expect(readFileSync(join(f.main, RECORD), "utf-8")).toBe(before);
	});

	it("refuses an approval of a foundation other than the one main holds, writing nothing", async () => {
		const before = readFileSync(join(f.main, RECORD), "utf-8");
		const r = await approve(f.main, "demo", "home.full", "sandy", {
			foundationHash: "f".repeat(64),
		});
		expect(r).toMatchObject({
			approved: false,
			reason: expect.stringMatching(/foundation on main/),
		});
		expect(readFileSync(join(f.main, RECORD), "utf-8")).toBe(before);
		const { app } = await mockupOf("home.full");
		expect(
			await approve(f.main, "demo", "home.full", "sandy", { foundationHash: app.foundation.hash }),
		).toMatchObject({ approved: true });
	});

	it("refuses an unknown mockup, an app name that leaves the folder, and an approval by nobody", async () => {
		expect(await approve(f.main, "demo", "nope", "sandy")).toMatchObject({ approved: false });
		expect(await approve(f.main, "../demo", "home.full", "sandy")).toMatchObject({
			approved: false,
		});
		expect(await approve(f.main, "demo", "home.full", " ")).toMatchObject({ approved: false });
	});
});
