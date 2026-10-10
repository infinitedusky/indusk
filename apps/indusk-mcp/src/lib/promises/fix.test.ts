import { describe, expect, it } from "vitest";
import { type BrokenPromise, fixPrompt } from "./fix.js";

// promise: a-break-opens-a-fix-in-one-click

/**
 * plan-cockpit A31, the package's half: the fix prompt a broken promise's page
 * (and the editor) starts the developer's own `claude` with is built once, here,
 * from the break's facts. The editor's half asserts its terminal command
 * carries this same prompt (apps/vscode-extension/src/core/fix-uses-package.test.ts).
 */

const broken: BrokenPromise = {
	promise: "seats-held",
	source: "production",
	sourceLabel: "https://x.fly.dev:16687/",
	statement: "A seat is never held by two players at once.",
	symptom: "seat 4 held twice",
	traceId: "4bf92f3577b34da6",
	tests: ["src/seats.test.ts", "src/holds.test.ts"],
};

describe("A31 — the fix prompt carries the break's facts", () => {
	it("names the promise, its source and its statement", () => {
		const prompt = fixPrompt(broken);
		expect(prompt).toContain("`seats-held`");
		expect(prompt).toContain("production");
		expect(prompt).toContain("A seat is never held by two players at once.");
	});

	it("gives the symptom, the trace link and every test", () => {
		const prompt = fixPrompt(broken);
		expect(prompt).toContain("Symptom: seat 4 held twice");
		expect(prompt).toContain("Trace: https://x.fly.dev:16687/trace/4bf92f3577b34da6");
		expect(prompt).toContain("Tests that prove it: src/seats.test.ts, src/holds.test.ts");
	});

	it("leaves out a line it has no fact for", () => {
		const prompt = fixPrompt({
			promise: "p",
			source: "local",
			sourceLabel: "l",
			statement: "s",
			tests: [],
		});
		expect(prompt).not.toContain("Symptom:");
		expect(prompt).not.toContain("Trace:");
		expect(prompt).not.toContain("Tests that prove it:");
	});

	it("is one line per fact, whatever the span wrote: no control character reaches a terminal", () => {
		const prompt = fixPrompt({ ...broken, symptom: "seat 4\r\nheld\u0003 twice\tnow" });
		expect(prompt).toContain("Symptom: seat 4 held twice now");
		// biome-ignore lint/suspicious/noControlCharactersInRegex: asserting their absence is the point
		expect(prompt).not.toMatch(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/);
	});
});
