// clause: a-release-waits-for-a-known-wrong/release-refuses

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { followOnRefusal, landedOnTrunk, openFollowOns } from "./follow-on-refusal.js";
import { runRelease } from "./run.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
function planning(plans: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "refusal-"));
	dirs.push(dir);
	for (const [name, frontmatter] of Object.entries(plans)) {
		mkdirSync(join(dir, name), { recursive: true });
		writeFileSync(join(dir, name, "brief.md"), `---\n${frontmatter}\n---\n\n# ${name}\n`);
	}
	return dir;
}
const followOn = (status = "draft") => `status: ${status}\nfollow_on_of: p/q-1`;

describe("T15 — the release waits for open follow-ons", () => {
	it("names every open follow-on, in order, and never an ordinary plan", () => {
		const dir = planning({
			z: followOn(),
			x: followOn("accepted"),
			y: followOn(),
			ordinary: "status: draft",
			"fix-orphan": "status: draft",
		});
		expect(openFollowOns(dir).map((p) => p.name)).toEqual(["x", "y", "z"]);
		const words = followOnRefusal(openFollowOns(dir));
		for (const name of ["x", "y", "z"]) expect(words).toContain(name);
		expect(words).not.toContain("ordinary");
	});

	it("proceeds once each is landed, abandoned or archived", () => {
		const dir = planning({
			a: followOn("landed"),
			b: followOn("abandoned"),
			c: followOn("archived"),
			d: followOn(),
		});
		mkdirSync(join(dir, "archive", "e"), { recursive: true });
		writeFileSync(join(dir, "archive", "e", "brief.md"), `---\n${followOn()}\n---\n`);
		expect(openFollowOns(dir).map((p) => p.name)).toEqual(["d"]);
		expect(openFollowOns(planning({ a: followOn("landed") }))).toEqual([]);
	});

	it("an absent planning folder has none", () => {
		expect(openFollowOns("/nonexistent/planning")).toEqual([]);
	});
});

describe("runRelease — the wait comes before any publish step", () => {
	const deps = (follow: string[], steps: Record<string, unknown> = {}) => {
		const ran: string[] = [];
		return {
			ran,
			deps: {
				steps: { release: { command: "publish" }, ...steps } as never,
				exec: (c: string) => {
					ran.push(c);
					return { code: 0 };
				},
				now: () => new Date(),
				codeKey: () => null,
				coveringRun: () => null,
				recordGreen: () => {},
				openFollowOns: () => follow,
			},
		};
	};

	it("refuses with the plans named and runs nothing", () => {
		const { ran, deps: d } = deps(["x", "y"]);
		const out = runRelease(d);
		expect(out).toMatchObject({ published: false, done: false, waitingOn: ["x", "y"] });
		expect(ran).toEqual([]);
	});

	it("publishes when none is open", () => {
		const open = deps([]);
		expect(runRelease(open.deps).done).toBe(true);
		expect(open.ran).toEqual(["publish"]);
	});
});

describe("T39 — what closes a follow-on", () => {
	it("a follow-on that landed on the trunk no longer refuses, though its folder is not archived", () => {
		const dir = planning({ a: followOn(), b: followOn() });
		expect(openFollowOns(dir, (name) => name === "a").map((p) => p.name)).toEqual(["b"]);
	});

	it("a brief that cannot be parsed still refuses, as unreadable", () => {
		const dir = planning({ a: "status: [draft\nfollow_on_of: p/q-1" });
		expect(openFollowOns(dir)).toEqual([{ name: "a", of: "p/q-1", status: "unreadable" }]);
	});

	it("a brief marked superseded still refuses", () => {
		expect(openFollowOns(planning({ a: followOn("superseded") })).map((p) => p.name)).toEqual([
			"a",
		]);
	});

	it("an unreadable brief with no follow_on_of is an ordinary plan", () => {
		expect(openFollowOns(planning({ a: "status: [draft" }))).toEqual([]);
	});

	it("reads landing from the trunk's merge subjects", () => {
		const dir = mkdtempSync(join(tmpdir(), "landed-"));
		dirs.push(dir);
		const git = (...a: string[]) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf-8" });
		git("init", "-q", "-b", "main");
		git(
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"commit",
			"--allow-empty",
			"-q",
			"-m",
			"Merge plan/seat-holds-q-1: seat-holds-q-1 landed",
		);
		git(
			"-c",
			"user.name=t",
			"-c",
			"user.email=t@t",
			"commit",
			"--allow-empty",
			"-q",
			"-m",
			"work on other-q-1",
		);
		const landed = landedOnTrunk(dir);
		expect(landed("seat-holds-q-1")).toBe(true);
		expect(landed("other-q-1")).toBe(false);
	});

	it("a release_follow_on of false is refused when read, naming the key", async () => {
		const root = mkdtempSync(join(tmpdir(), "steps-"));
		dirs.push(root);
		mkdirSync(join(root, ".indusk"), { recursive: true });
		writeFileSync(
			join(root, ".indusk", "config.json"),
			JSON.stringify({ workflow: { steps: { release_follow_on: false } } }),
		);
		const { readWorkflowSteps } = await import("../checks/steps.js");
		expect(() => readWorkflowSteps(root)).toThrow(/release_follow_on/);
	});
});
