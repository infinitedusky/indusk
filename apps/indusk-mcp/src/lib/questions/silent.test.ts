// clause: a-decision-is-a-question/never-decided-silently

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addedLines, silentDecisions, silentIn } from "./silent.js";

const recorded = new Set(["q-3"]);

describe("silentIn", () => {
	it("T35 — ignores the phrase where it is quoted", () => {
		const text =
			'Measure: share recorded only as "decided unattended" with no question.\nUse `decided unattended` to mean this.';
		expect(silentIn(text, recorded)).toEqual([]);
	});

	it("T36 — judges other words for a choice made without a question", () => {
		for (const t of ["Decisions made unattended", "Chosen unattended: SQLite", "Made unattended."])
			expect(silentIn(t, recorded)).toHaveLength(1);
	});

	it("T36 — a line that introduces a list needs a reference on every item", () => {
		const text =
			"Decisions made unattended:\n1. A (question: q-3)\n2. B\n3. C (question: q-9)\n\nNext paragraph.";
		const found = silentIn(text, recorded);
		expect(found.map((f) => f.line)).toEqual([3, 4]);
	});

	it("judges only the lines it is given", () => {
		const text = "old: decided unattended\nnew: decided unattended";
		expect(silentIn(text, recorded, new Set([2])).map((f) => f.line)).toEqual([2]);
	});
});

describe("silentDecisions", () => {
	it("T35 — a step that wrote no new choice is upheld though the documents quote the phrase", () => {
		const dir = mkdtempSync(join(tmpdir(), "silent-"));
		try {
			mkdirSync(dir, { recursive: true });
			writeFileSync(join(dir, "brief.md"), "Old: Decided unattended without a question.\n");
			const before = new Map([["brief.md", "Old: Decided unattended without a question.\n"]]);
			expect(silentDecisions(dir, recorded, before)).toEqual([]);
			writeFileSync(
				join(dir, "brief.md"),
				"Old: Decided unattended without a question.\nNew: Chosen unattended.\n",
			);
			expect(silentDecisions(dir, recorded, before).map((f) => f.line)).toEqual([2]);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("addedLines", () => {
	it("counts repeated lines", () => {
		expect(addedLines("a\nb", "a\nb\nb\nc").map((x) => x.line)).toEqual([3, 4]);
	});
});
