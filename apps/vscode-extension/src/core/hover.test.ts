import { describe, expect, it } from "vitest";
import { line } from "./fixture.js";
import { hover } from "./hover.js";

/**
 * vscode-extension A21: a hover shows text from spans and sources as text,
 * never as Markdown a viewer could click. A19 (its hover half): before the
 * first health line, the hover says "not reading", as the marker does.
 *
 * promise: the-editor-only-shows
 * promise: a-break-reaches-the-editor
 */

describe("hover", () => {
	it("A21 — a symptom or a reason written as a link renders as its characters", () => {
		const view = { line: line({ productionState: "red" }), notReading: false };
		const prod = view.line.sources[0] as { rows: { symptom?: string }[] };
		(prod.rows[0] as { symptom?: string }).symptom = "[open](https://example.test)";
		const local = view.line.sources[1] as unknown as { ok: boolean; reason: string };
		local.ok = false;
		local.reason = "[open](https://example.test) *now*";
		const text = hover("seats-held", view);
		expect(text).not.toMatch(/(^|[^\\])\[open\]\(/);
		expect(text).not.toMatch(/(^|[^\\])\*now/);
		expect(text).toContain("open");
	});

	it("A19 — before the first health line the hover says not reading, as the marker does", () => {
		expect(hover("seats-held", null)).toMatch(/not reading/i);
		expect(hover("seats-held", null)).not.toMatch(/not in this project/);
	});
});
