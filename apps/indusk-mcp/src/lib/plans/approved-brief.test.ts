import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { approvalFrontmatter, briefHash, briefStandingOf } from "./approved-brief.js";

/**
 * promise: approval-is-of-the-brief — brief-as-the-contract Build Phase 2: a
 * brief edited after its approval reads as changed since, from the hash the
 * impl recorded; the comparison `amendmentsOf` builds on.
 */

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "approved-brief-"));
	mkdirSync(dir, { recursive: true });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const implWith = (keys: Record<string, string>) =>
	`---\ntitle: x\nstatus: approved\n${Object.entries(keys)
		.map(([k, v]) => `${k}: ${v}`)
		.join("\n")}\n---\n\n# impl\n`;

describe("a brief's standing against its approval", () => {
	it("is unapproved when the impl records no approved brief", () => {
		writeFileSync(join(dir, "brief.md"), "# brief\n");
		writeFileSync(join(dir, "impl.md"), implWith({}));
		expect(briefStandingOf(dir)).toEqual({ state: "unapproved" });
	});

	it("is unchanged for the brief that was approved, and changed once it is edited", () => {
		const brief = "# brief\n\nafter two weeks\n";
		writeFileSync(join(dir, "brief.md"), brief);
		writeFileSync(
			join(dir, "impl.md"),
			implWith(approvalFrontmatter(brief, "sandy", new Date("2026-10-12T00:00:00Z"))),
		);
		expect(briefStandingOf(dir)).toEqual({ state: "unchanged", approved: briefHash(brief) });

		const edited = brief.replace("two", "three");
		writeFileSync(join(dir, "brief.md"), edited);
		expect(briefStandingOf(dir)).toEqual({
			state: "changed",
			approved: briefHash(brief),
			now: briefHash(edited),
		});
	});

	it("records every value as a quoted string, so a digit-and-e hash or a timestamp is not parsed as a number or a date", () => {
		const fm = approvalFrontmatter("x", "sandy", new Date("2026-10-12T00:00:00Z"));
		for (const v of Object.values(fm)) expect(v).toMatch(/^".*"$/);
	});
});
