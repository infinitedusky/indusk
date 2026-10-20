// clause: a-decision-is-a-question/never-decided-silently
import { describe, expect, it } from "vitest";
import { unkeptQuestion } from "./question-unkept.js";

describe("unkeptQuestion", () => {
	it("T34 — tells the session to stop, never to decide, and names the failure in the error", () => {
		const out = unkeptQuestion("q-3", new Error("history is locked"));
		expect(out.message).toMatch(/stop/i);
		expect(out.message).not.toMatch(/record the choice|decide (it|this) (on )?your own/i);
		expect(out.message).toMatch(/do not decide/i);
		expect(out.error).toContain("q-3");
		expect(out.error).toContain("history is locked");
	});

	it("names a failure that is not an Error", () => {
		expect(unkeptQuestion("q-1", "disk full").error).toContain("disk full");
	});
});
