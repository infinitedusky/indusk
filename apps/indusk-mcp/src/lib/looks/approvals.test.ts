import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Fixture, makeFixture } from "../bookkeeping/fixture.test-support.js";
import { approvalOf, readApprovals, readStoryApprovals, storyApprovalOf } from "./approvals.js";
import { approve, withdraw } from "./approve.js";
import { LooksAppError, readApp } from "./mockups.js";

/**
 * promise: a-mockup-is-approved-by-a-person — ui-promises A3, A4 (the record's
 * reading) and the writer the cockpit's Approve calls (A2 drives it through
 * the admin in Build Phase 4); A30 (an approval binds the mockup shown) and
 * A35 (it binds the declarations the check trusts).
 * promise: every-part-of-the-ui-is-covered — A35.
 * promise: a-mockup-is-approved-by-a-person — storybook-components A38 (the
 * record and its reading apart from the write side the admin's routes call).
 *
 * The fixture app is copied into a main checkout with a plan worktree beside
 * it, so `approve` is seen writing and committing in the checkout it is
 * given — on the plan's branch from the worktree, leaving `main` alone.
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

	// A35 — the declarations the check trusts are bound like the foundation.
	const MOCKUPS = ".indusk/mockups/demo";
	const declarationChanges: Array<[string, string, (text: string) => string]> = [
		["a device's size", "devices.json", (t) => t.replace('"height": 844', '"height": 600')],
		[
			"an ignore tag",
			"screens.json",
			(t) => {
				const o = JSON.parse(t);
				return JSON.stringify({ ...o, ignore: [...(o.ignore ?? []), "main"] });
			},
		],
		[
			"the app's sources",
			"screens.json",
			(t) => JSON.stringify({ ...JSON.parse(t), sources: ["elsewhere"] }),
		],
	];
	for (const [what, file, change] of declarationChanges) {
		it(`A35 changing ${what} returns an approved mockup to proposed`, async () => {
			const empty = await mockupOf("home.empty");
			expect(approvalOf(empty.app, empty.mockup, readApprovals(empty.app)).state).toBe("approved");
			const path = join(f.main, MOCKUPS, file);
			writeFileSync(path, change(readFileSync(path, "utf-8")));
			const after = await mockupOf("home.empty");
			expect(approvalOf(after.app, after.mockup, readApprovals(after.app)).state).toBe("proposed");
		});
	}

	it("A35 an entry that binds no declarations reads proposed", async () => {
		const empty = await mockupOf("home.empty");
		const entries = readApprovals(empty.app).map((e) => {
			const { declarationsHash: _, ...rest } = e as typeof e & { declarationsHash?: string };
			return rest;
		});
		expect(approvalOf(empty.app, empty.mockup, entries).state).toBe("proposed");
	});

	it("a record that is not a list of entries is refused, never read as empty", async () => {
		writeFileSync(join(f.main, RECORD), JSON.stringify({ approvals: [{ mockup: "home.empty" }] }));
		const app = await readApp(f.main, "demo");
		expect(() => readApprovals(app)).toThrow(LooksAppError);
	});
});

describe("approve — the cockpit's writer", () => {
	it("appends an entry bound to the current hashes and commits only the record on the worktree's branch, never on main", async () => {
		f.git(f.worktree, "merge", "-q", "main");
		writeFileSync(join(f.worktree, "staged.txt"), "a person's work\n");
		f.git(f.worktree, "add", "staged.txt");
		const mainBefore = f.git(f.main, "rev-parse", "main");

		const r = await approve(f.worktree, "demo", "home.full", "sandy");
		expect(r.approved).toBe(true);

		const app = await readApp(f.worktree, "demo");
		const mockup = app.mockups.find((m) => m.name === "home.full");
		if (!mockup) throw new Error("no mockup");
		expect(approvalOf(app, mockup, readApprovals(app)).state).toBe("approved");
		const entries = JSON.parse(readFileSync(join(f.worktree, RECORD), "utf-8")).approvals;
		expect(entries.at(-1)).toMatchObject({
			mockup: "home.full",
			mockupHash: mockup.hash,
			foundationHash: app.foundation.hash,
			by: "sandy",
		});
		expect(f.git(f.worktree, "log", "-1", "--format=%s")).toMatch(/^chore\(indusk\): looks — /);
		expect(f.git(f.worktree, "show", "--name-only", "--format=", "HEAD")).toBe(RECORD);
		// What the person had staged stays staged, out of the commit.
		expect(f.git(f.worktree, "status", "--porcelain")).toBe("A  staged.txt");
		// Main is untouched: the approval travels with the branch.
		expect(f.git(f.main, "rev-parse", "main")).toBe(mainBefore);
		const onMain = JSON.parse(readFileSync(join(f.main, RECORD), "utf-8")).approvals;
		expect(onMain.some((e: { mockupHash: string }) => e.mockupHash === mockup.hash)).toBe(false);
	});

	it("refuses to commit a record on a detached HEAD, leaving the entry written and saying why", async () => {
		f.git(f.worktree, "merge", "-q", "main");
		f.git(f.worktree, "checkout", "-q", "--detach");
		const r = await approve(f.worktree, "demo", "home.full", "sandy");
		expect(r).toMatchObject({ approved: true, commit: { committed: false } });
	});

	it("gives a mockup already approved as it is no second entry", async () => {
		const before = readFileSync(join(f.main, RECORD), "utf-8");
		const r = await approve(f.main, "demo", "home.empty", "sandy");
		expect(r.approved).toBe(true);
		expect(readFileSync(join(f.main, RECORD), "utf-8")).toBe(before);
	});

	it("refuses an approval of a foundation other than the one the checkout holds, writing nothing", async () => {
		const before = readFileSync(join(f.main, RECORD), "utf-8");
		const r = await approve(f.main, "demo", "home.full", "sandy", {
			foundationHash: "f".repeat(64),
		});
		expect(r).toMatchObject({
			approved: false,
			reason: expect.stringMatching(/foundation in /),
		});
		expect(readFileSync(join(f.main, RECORD), "utf-8")).toBe(before);
		const { app } = await mockupOf("home.full");
		expect(
			await approve(f.main, "demo", "home.full", "sandy", { foundationHash: app.foundation.hash }),
		).toMatchObject({ approved: true });
	});

	// A30
	it("A30 refuses a mockup changed since the page showed it, naming both hashes, and writes nothing", async () => {
		const before = readFileSync(join(f.main, RECORD), "utf-8");
		const { app, mockup } = await mockupOf("home.full");
		const shown = "e".repeat(64);
		const r = await approve(f.main, "demo", "home.full", "sandy", {
			foundationHash: app.foundation.hash,
			mockupHash: shown,
		} as { foundationHash: string });
		expect(r).toMatchObject({ approved: false });
		const reason = r.approved ? "" : r.reason;
		expect(reason).toContain(shown.slice(0, 8));
		expect(reason).toContain(mockup.hash.slice(0, 8));
		expect(readFileSync(join(f.main, RECORD), "utf-8")).toBe(before);
	});

	it("refuses an unknown mockup, an app name that leaves the folder, and an approval by nobody", async () => {
		expect(await approve(f.main, "demo", "nope", "sandy")).toMatchObject({ approved: false });
		expect(await approve(f.main, "../demo", "home.full", "sandy")).toMatchObject({
			approved: false,
		});
		expect(await approve(f.main, "demo", "home.full", " ")).toMatchObject({ approved: false });
	});
});

/**
 * promise: a-changed-component-reopens-its-mockups — storybook-components A12.
 * promise: a-mockup-is-approved-by-a-person — a story is approved like a mockup.
 *
 * The components fixture: `home.default` composes `badge.ok` and
 * `card.default`, each approved; its `badge.ok` snapshot is re-rendered (a
 * changed component), which reopens the story and the mockup. The cockpit's
 * Approve then sends what the page showed: the story's snapshot hash, and the
 * mockup's composed hash and `componentsHash`.
 *
 * promise: a-mockup-is-approved-by-a-person — storybook-components A34 (a
 * mockup composing components is approved only with the `componentsHash` shown).
 */
describe("approve — a mockup reopened by a changed component", () => {
	const COMPONENTS = join(__dirname, "..", "..", "__tests__", "fixtures", "components-app");
	let g: Fixture;
	beforeEach(() => {
		g = makeFixture();
		cpSync(COMPONENTS, g.main, { recursive: true });
		const snapshot = join(g.main, ".indusk/mockups/demo/components/badge.ok.html");
		writeFileSync(
			snapshot,
			readFileSync(snapshot, "utf-8").replace("var(--space-2)", "var(--space-3)"),
		);
		g.git(g.main, "add", "-A");
		g.git(g.main, "commit", "-qm", "the components fixture, badge.ok re-rendered");
	});
	afterEach(() => g.cleanup());

	const read = async () => {
		const app = await readApp(g.main, "demo");
		const home = app.mockups.find((m) => m.name === "home.default");
		const story = app.stories.find((s) => s.name === "badge.ok");
		if (!home || !story) throw new Error("fixture lacks home.default or badge.ok");
		return { app, home, story };
	};

	// A12
	it("A12 approving the reopened mockup again, with the new componentsHash, makes it read approved", async () => {
		const before = await read();
		expect(approvalOf(before.app, before.home, readApprovals(before.app)).state).toBe("proposed");

		const story = await approve(g.main, "demo", "badge.ok", "sandy", {
			kind: "story",
			snapshotHash: before.story.hash,
			stylesheetHash: before.story.stylesheetHash ?? undefined,
			foundationHash: before.app.foundation.hash,
		});
		expect(story).toMatchObject({ approved: true });
		const mockup = await approve(g.main, "demo", "home.default", "sandy", {
			mockupHash: before.home.hash,
			componentsHash: before.home.componentsHash,
			foundationHash: before.app.foundation.hash,
		});
		expect(mockup).toMatchObject({ approved: true });

		const after = await read();
		const approval = approvalOf(after.app, after.home, readApprovals(after.app));
		expect(approval.state).toBe("approved");
		expect(approval.state === "approved" && approval.entry.componentsHash).toBe(
			after.home.componentsHash,
		);
	});

	it("refuses the mockup while a component it composes has no approved story, naming it, and writes nothing", async () => {
		const record = join(g.main, ".indusk/mockups/demo/approved.json");
		const held = readFileSync(record, "utf-8");
		const { app, home } = await read();
		const r = await approve(g.main, "demo", "home.default", "sandy", {
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
			foundationHash: app.foundation.hash,
		});
		expect(r).toMatchObject({ approved: false, reason: expect.stringContaining("badge.ok") });
		expect(readFileSync(record, "utf-8")).toBe(held);
	});

	it("refuses a componentsHash other than the one the checkout composes, and a story sent without its snapshot hash", async () => {
		const { app, home, story } = await read();
		await approve(g.main, "demo", "badge.ok", "sandy", {
			kind: "story",
			snapshotHash: story.hash,
			stylesheetHash: story.stylesheetHash ?? undefined,
			foundationHash: app.foundation.hash,
		});
		const stale = await approve(g.main, "demo", "home.default", "sandy", {
			mockupHash: home.hash,
			componentsHash: "c".repeat(64),
			foundationHash: app.foundation.hash,
		});
		expect(stale).toMatchObject({ approved: false, reason: expect.stringContaining("cccccccc") });
		const unseen = await approve(g.main, "demo", "badge.broken", "sandy", {
			kind: "story",
		} as never);
		expect(unseen).toMatchObject({ approved: false });
	});
});

/**
 * promise: a-mockup-is-approved-by-a-person — storybook-components A34.
 *
 * A component's stylesheet is inlined into the composed mockup's document but
 * is not part of `mockupHash`; only `componentsHash` holds it. An Approve that
 * sends the mockup's hash and not its `componentsHash` would bind a stylesheet
 * the person may never have seen.
 */
describe("approve — a composed mockup needs the componentsHash it was shown at", () => {
	const COMPONENTS = join(__dirname, "..", "..", "__tests__", "fixtures", "components-app");
	const RECORD_FILE = ".indusk/mockups/demo/approved.json";
	let g: Fixture;
	beforeEach(() => {
		g = makeFixture();
		cpSync(COMPONENTS, g.main, { recursive: true });
		g.git(g.main, "add", "-A");
		g.git(g.main, "commit", "-qm", "the components fixture");
	});
	afterEach(() => g.cleanup());

	// A34
	it("A34 a mockup that composes components, sent with its mockupHash and without its componentsHash, is refused and writes nothing; one that composes none approves on mockupHash alone", async () => {
		const app = await readApp(g.main, "demo");
		const home = app.mockups.find((m) => m.name === "home.default");
		const empty = app.mockups.find((m) => m.name === "home.empty");
		if (!home || !empty) throw new Error("fixture lacks home.default or home.empty");
		const foundationHash = app.foundation.hash;
		// Taken back first, so an Approve would have something to write.
		const taken = await withdraw(g.main, "demo", "home.default", "sandy", "mockup", {
			foundationHash,
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
		});
		expect(taken).toMatchObject({ withdrawn: true });
		const before = readFileSync(join(g.main, RECORD_FILE), "utf-8");

		const r = await approve(g.main, "demo", "home.default", "sandy", {
			foundationHash,
			mockupHash: home.hash,
		});
		expect(r).toMatchObject({
			approved: false,
			reason: expect.stringContaining("componentsHash"),
		});
		expect(readFileSync(join(g.main, RECORD_FILE), "utf-8")).toBe(before);

		expect(
			await approve(g.main, "demo", "home.default", "sandy", {
				foundationHash,
				mockupHash: home.hash,
				componentsHash: home.componentsHash,
			}),
		).toMatchObject({ approved: true });

		expect(empty.uses).toEqual([]);
		expect(
			await approve(g.main, "demo", "home.empty", "sandy", {
				foundationHash,
				mockupHash: empty.hash,
			}),
		).toMatchObject({ approved: true });
	});
});

describe("the record and its reading are one subpath, the write side another", () => {
	// A38
	it("A38 ./looks/approvals exports no write; ./looks/approve exports approve, withdraw, approver and componentsHashesMissing; the admin's routes import the write side from it only", async () => {
		const pkg = JSON.parse(
			readFileSync(join(__dirname, "..", "..", "..", "package.json"), "utf-8"),
		) as {
			exports: Record<string, unknown>;
		};
		expect(Object.keys(pkg.exports), "the write side has its own subpath").toContain(
			"./looks/approve",
		);

		const reading = Object.keys(await import("./approvals.js"));
		for (const name of ["approve", "withdraw", "approver"]) {
			expect(reading, `${name} is the write side`).not.toContain(name);
		}
		expect(reading).toEqual(expect.arrayContaining(["readApprovals", "approvalOf", "standingOf"]));

		const writePath = "./approve.js";
		const writing = Object.keys(
			await import(/* @vite-ignore */ writePath).catch(() => ({}) as Record<string, unknown>),
		);
		expect(writing).toEqual(
			expect.arrayContaining(["approve", "withdraw", "approver", "componentsHashesMissing"]),
		);

		const routes = join(
			__dirname,
			"..",
			"..",
			"..",
			"..",
			"indusk-admin",
			"src",
			"app",
			"api",
			"looks",
			"[app]",
		);
		for (const route of ["approve", "unapprove"]) {
			const source = readFileSync(join(routes, route, "route.ts"), "utf-8");
			expect(source, `${route} route imports its write from ./looks/approve`).toMatch(
				/from "@infinitedusky\/indusk-mcp\/looks\/approve";/,
			);
			expect(source, `${route} route takes nothing written from ./looks/approvals`).not.toMatch(
				/\/looks\/approvals"/,
			);
		}
	});
});

/**
 * promise: mockups-render-in-the-cockpit — T1. Every story and mockup is drawn
 * in the cockpit under the app's element rules (`_reset.css`), whose hash the
 * catalog keeps as `baseRulesHash`. An approval records it and reads proposed
 * once the rules change; an entry recorded without it reads as before.
 */
describe("approvals bound to the app's element rules", () => {
	const COMPONENTS = join(__dirname, "..", "..", "__tests__", "fixtures", "components-app");
	const CATALOG = ".indusk/mockups/demo/components.json";
	let g: Fixture;
	beforeEach(() => {
		g = makeFixture();
		cpSync(COMPONENTS, g.main, { recursive: true });
		g.git(g.main, "add", "-A");
		g.git(g.main, "commit", "-qm", "the components fixture");
	});
	afterEach(() => g.cleanup());

	const setRules = (hash: string) => {
		const file = join(g.main, CATALOG);
		const catalog = JSON.parse(readFileSync(file, "utf-8"));
		writeFileSync(file, JSON.stringify({ ...catalog, baseRulesHash: hash }, null, "\t"));
	};

	// T1
	it("T1 a story or mockup approved before the element rules change reads proposed after; an entry recorded without the hash reads approved", async () => {
		setRules("a".repeat(64));
		const first = await readApp(g.main, "demo");
		const badge = first.stories.find((s) => s.name === "badge.ok");
		const home = first.mockups.find((m) => m.name === "home.default");
		if (!badge || !home) throw new Error("fixture lacks badge.ok or home.default");
		const foundationHash = first.foundation.hash;
		// Both fixture entries were recorded without the rules' hash: they stay approved.
		expect(storyApprovalOf(first, badge, readStoryApprovals(first)).state).toBe("approved");
		expect(approvalOf(first, home, readApprovals(first)).state).toBe("approved");

		// Taken back and approved again, they record the rules they were shown under.
		await withdraw(g.main, "demo", "home.default", "sandy", "mockup", {
			foundationHash,
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
		});
		await withdraw(g.main, "demo", "badge.ok", "sandy", "story", {
			foundationHash,
			snapshotHash: badge.hash,
		});
		await approve(g.main, "demo", "badge.ok", "sandy", {
			kind: "story",
			snapshotHash: badge.hash,
			stylesheetHash: badge.stylesheetHash ?? undefined,
			foundationHash,
		});
		await approve(g.main, "demo", "home.default", "sandy", {
			mockupHash: home.hash,
			componentsHash: home.componentsHash,
			foundationHash,
		});
		const approved = await readApp(g.main, "demo");
		const storyNow = approved.stories.find((s) => s.name === "badge.ok") ?? badge;
		const entries = readStoryApprovals(approved).filter((e) => e.story === "badge.ok");
		expect(entries[entries.length - 1]).toMatchObject({ baseRulesHash: "a".repeat(64) });
		const mockupEntries = readApprovals(approved).filter((e) => e.mockup === "home.default");
		expect(mockupEntries[mockupEntries.length - 1]).toMatchObject({
			baseRulesHash: "a".repeat(64),
		});
		expect(storyApprovalOf(approved, storyNow, readStoryApprovals(approved)).state).toBe(
			"approved",
		);
		expect(approvalOf(approved, home, readApprovals(approved)).state).toBe("approved");

		// The app's element rules change: what they were drawn under is gone.
		setRules("b".repeat(64));
		const changed = await readApp(g.main, "demo");
		const storyAfter = changed.stories.find((s) => s.name === "badge.ok") ?? badge;
		const homeAfter = changed.mockups.find((m) => m.name === "home.default") ?? home;
		expect(storyApprovalOf(changed, storyAfter, readStoryApprovals(changed)).state).toBe(
			"proposed",
		);
		expect(approvalOf(changed, homeAfter, readApprovals(changed)).state).toBe("proposed");
		// A story approved without the hash is read as before.
		const card = changed.stories.find((s) => s.name === "card.default");
		if (!card) throw new Error("fixture lacks card.default");
		expect(storyApprovalOf(changed, card, readStoryApprovals(changed)).state).toBe("approved");
	});
});
