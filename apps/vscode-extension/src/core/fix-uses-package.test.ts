import { fixPrompt } from "@infinitedusky/indusk-mcp/promises/fix";
import { describe, expect, it } from "vitest";
import { fixAction } from "./fix.js";

// promise: a-break-opens-a-fix-in-one-click

/**
 * plan-cockpit A31, the editor's half: the terminal command *Fix with Claude*
 * starts carries the prompt the package builds, shell-quoted; the editor words
 * none of it itself.
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

describe("A31 — the editor's fix is the package's prompt", () => {
	it("the terminal command contains the package's fix prompt, quoted as one shell word", () => {
		const a = fixAction(broken, { projectRoot: "/p", claudeOnPath: true });
		if (!("terminal" in a)) throw new Error("no terminal");
		const prompt = fixPrompt(broken);
		expect(prompt.length).toBeGreaterThan(0);
		expect(a.terminal.command).toBe(`claude '${prompt.replace(/'/g, `'\\''`)}'`);
	});
});
