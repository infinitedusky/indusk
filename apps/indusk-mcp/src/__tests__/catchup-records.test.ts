import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * incident-recording A9 — promise: catchup-records-what-it-finds.
 * incident-recording A13 — promise: an-open-incident-stays-loud.
 *
 * The catchup skill's promise step (8a) is what makes a session record an
 * unrecorded production violation itself and say what it opened (A9), and
 * rank open incidents, with their ages, ahead of the roadmap (A13). Read from
 * the package's source, which `.claude/skills/` is pinned to by parity.
 */

const SKILL = join(new URL("../../skills/", import.meta.url).pathname, "catchup.md");

function step8a(): string {
	const text = readFileSync(SKILL, "utf-8");
	const start = text.indexOf("### 8a.");
	const end = text.indexOf("\n### ", start + 1);
	const section = text.slice(start, end === -1 ? undefined : end);
	// A cutter that returns nothing makes every assertion below meaningless.
	if (start === -1 || section.length < 400) {
		throw new Error(`catchup.md has no step 8a section to read (${section.length} chars)`);
	}
	return section;
}

describe("A9 — catchup records, and never hands the recording to the person", () => {
	it("names the recording tool and says to report what it opened", () => {
		const s = step8a();
		expect(s).toContain("record_breaks");
		expect(s).toMatch(/what it opened/i);
	});

	it("nowhere tells the person to run `promises watch`", () => {
		expect(step8a()).not.toMatch(/Run `indusk promises watch`/);
	});
});

describe("A13 — open incidents, with their ages, rank ahead of the roadmap", () => {
	it("puts open incidents and how long each has been open ahead of the roadmap", () => {
		const s = step8a();
		expect(s).toMatch(/open incidents?[^.]*\b(age|ages|how long)\b/i);
		expect(s).toMatch(/open incidents?[^.]*(ahead of|before|outrank)[^.]*roadmap/i);
	});
});
