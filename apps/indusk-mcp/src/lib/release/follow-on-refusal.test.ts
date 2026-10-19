// clause: a-release-waits-for-a-known-wrong/release-refuses
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { followOnRefusal, openFollowOns } from "./follow-on-refusal.js";
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

	it("publishes when none is open, or when the step is turned off", () => {
		const open = deps([]);
		expect(runRelease(open.deps).done).toBe(true);
		const off = deps(["x"], { release_follow_on: false });
		expect(runRelease(off.deps).done).toBe(true);
		expect(off.ran).toEqual(["publish"]);
	});
});
