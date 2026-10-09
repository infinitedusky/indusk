import { describe, expect, it } from "vitest";
import { line } from "./fixture.js";
import { markers } from "./markers.js";
import { onLine, onTick, problems, startSession } from "./session.js";

/**
 * vscode-extension A8–A10: a break reaches the open editor within two reads,
 * once, and clears when fixed; a source that cannot be read says so.
 *
 * promise: a-break-reaches-the-editor
 */

const code = "// promise: seats-held\n";
const at = (s: number) => Date.UTC(2026, 9, 8, 12, 30, s);

describe("session", () => {
	it("A8 — a break that becomes readable shows on its line, in Problems and in one notification by the next read", () => {
		let s = startSession(5_000);
		s = onLine(s, line(), at(0)).session;
		const r = onLine(s, line({ productionState: "red" }), at(5));
		expect(r.notify).toEqual([
			{ promise: "seats-held", source: "production", traceId: "t-1", symptom: "seat 4 held twice" },
		]);
		expect(problems(r.session)).toEqual([
			{
				promise: "seats-held",
				source: "production",
				message: "seats-held is broken in production: seat 4 held twice",
			},
		]);
		expect(markers({ path: "src/t.ts", text: code }, r.session.view)[0]?.tone).toBe("broken");
	});

	it("A9 — the same break read again does not notify again; a fixed break clears", () => {
		let s = startSession(5_000);
		s = onLine(s, line({ productionState: "red" }), at(0)).session;
		const again = onLine(s, line({ productionState: "red" }), at(5));
		expect(again.notify).toEqual([]);
		const fixed = onLine(again.session, line({ productionState: "fixed" }), at(10));
		expect(problems(fixed.session)).toEqual([]);
		expect(markers({ path: "src/t.ts", text: code }, fixed.session.view)[0]?.tone).toBe("ok");
		const newBreak = onLine(
			fixed.session,
			line({ productionState: "red", traceId: "t-2" }),
			at(15),
		);
		expect(newBreak.notify.map((b) => b.traceId)).toEqual(["t-2"]);
	});

	it("A10 — an unreadable or blind source is said, never holding; no line for two cadences is not reading", () => {
		let s = startSession(5_000);
		s = onLine(s, line({ productionOk: false, blind: true }), at(0)).session;
		expect(markers({ path: "src/t.ts", text: code }, s.view)[0]?.text).toBe(
			"seats-held · production watcher blind",
		);
		s = onLine(s, line({ productionOk: false }), at(5)).session;
		expect(markers({ path: "src/t.ts", text: code }, s.view)[0]?.text).toBe(
			"seats-held · production unreadable",
		);
		s = onTick(s, at(16));
		expect(markers({ path: "src/t.ts", text: code }, s.view)[0]?.text).toBe(
			"seats-held · not reading",
		);
	});
});
