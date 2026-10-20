// clause: a-release-waits-for-a-known-wrong/release-refuses
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { archiveDeadPlans } from "./archive-dead.js";

const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** T24 — a follow-on is never dead-archived, however old and untouched. */
describe("T24 — the dead-draft sweep leaves a follow-on open", () => {
	it("archives an old draft but not an old draft carrying follow_on_of", () => {
		const root = mkdtempSync(join(tmpdir(), "dead-follow-"));
		dirs.push(root);
		const old = new Date("2020-01-01T00:00:00Z");
		for (const [name, extra] of [
			["plain-draft", ""],
			["seat-holds-q-1", "follow_on_of: seat-holds/q-1\n"],
		] as const) {
			const dir = join(root, ".indusk", "planning", name);
			mkdirSync(dir, { recursive: true });
			const brief = join(dir, "brief.md");
			writeFileSync(brief, `---\nstatus: draft\n${extra}---\n\n# ${name}\n`);
			utimesSync(brief, old, old);
			utimesSync(dir, old, old);
		}
		const out = archiveDeadPlans(root, { days: 30, now: new Date("2026-10-19T00:00:00Z") });
		expect(out.archived.map((p) => p.name)).toEqual(["plain-draft"]);
		expect(out.skipped.find((s) => s.name === "seat-holds-q-1")?.reason).toMatch(/follow-on/);
	});
});
