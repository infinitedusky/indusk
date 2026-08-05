import { describe, expect, it } from "vitest";
import { formatFinding } from "./report.js";
import type { VerifyFinding } from "./verify.js";

/**
 * A26 (dawn-verify cleanup) — a finding says its subject once.
 *
 * The renderer used `finding.row ?? finding.item` as a subject prefix. For a
 * row-based finding that prefix is a short, stable id and reads well. For a
 * phantom finding `item` is the entire checklist-item text, and the message
 * already quotes it — so the whole item printed twice, once as a runaway prefix
 * and once inside the sentence.
 */

const PHANTOM: VerifyFinding = {
	kind: "phantom",
	item: "`parse(input)` — accept exactly three dot-separated non-negative integers",
	message:
		'"`parse(input)` — accept exactly three dot-separated non-negative integers" was checked off in Phase 1, but nothing outside the plan file changed since 78741f0.',
};

describe("A26 — a phantom finding's item text appears exactly once", () => {
	it("does not repeat the item as a subject prefix", () => {
		const rendered = formatFinding(PHANTOM);
		const occurrences = rendered.split(PHANTOM.item as string).length - 1;

		expect(occurrences).toBe(1);
	});

	it("still names the row for row-based findings", () => {
		const rendered = formatFinding({
			kind: "red-test",
			row: "A4",
			message: 'Row A4 claims "passing", but its test does not pass.',
		});

		expect(rendered).toContain("A4");
	});

	it("labels the finding with its kind", () => {
		expect(formatFinding(PHANTOM)).toContain("phantom");
	});
});
