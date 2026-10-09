import { describe, expect, it } from "vitest";
import { fixAction } from "./fix.js";

/**
 * vscode-extension A12, A13: one action starts the developer's own claude
 * with the break's facts.
 *
 * promise: a-break-opens-a-fix-in-one-click
 */

const broken = {
	promise: "seats-held",
	source: "production",
	sourceLabel: "https://x.fly.dev:16687",
	statement: "A seat is never held by two players at once.",
	symptom: "seat 4 held twice",
	traceId: "4bf92f3577b34da6",
	tests: ["src/seats.test.ts"],
};

describe("fix with Claude", () => {
	it("A12 — opens a terminal in the project running claude with the promise, symptom, trace link and tests", () => {
		const a = fixAction(broken, { projectRoot: "/p", claudeOnPath: true });
		if (!("terminal" in a)) throw new Error("no terminal");
		expect(a.terminal.cwd).toBe("/p");
		expect(a.terminal.name).toBe("Claude — seats-held");
		expect(a.terminal.command.startsWith("claude ")).toBe(true);
		for (const fact of [
			"seats-held",
			"seat 4 held twice",
			"https://x.fly.dev:16687/trace/4bf92f3577b34da6",
			"src/seats.test.ts",
		]) {
			expect(a.terminal.command).toContain(fact);
		}
	});

	it("A12 — the prompt is one shell word, whatever the symptom holds", () => {
		const a = fixAction(
			{ ...broken, symptom: `it's "bad" $HOME \`x\`` },
			{ projectRoot: "/p", claudeOnPath: true },
		);
		if (!("terminal" in a)) throw new Error("no terminal");
		expect(a.terminal.command).toMatch(/^claude '.*'$/s);
		expect(a.terminal.command).toContain(`it'\\''s`);
	});

	it("A13 — without claude, it says how to install it and opens nothing", () => {
		const a = fixAction(broken, { projectRoot: "/p", claudeOnPath: false });
		expect(a).toEqual({
			message: expect.stringMatching(
				/Claude Code is not installed.*npm install -g @anthropic-ai\/claude-code/s,
			),
		});
	});
});
