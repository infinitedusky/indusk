import { describe, expect, it } from "vitest";
import { fixAction } from "./fix.js";

/**
 * Fix with Claude opens a Claude Code tab in VS Code when the Claude Code
 * extension is installed, and starts claude in a terminal everywhere else.
 *
 * promise: a-fix-opens-in-the-claude-code-tab
 */

const broken = {
	promise: "seats-held",
	source: "production",
	sourceLabel: "https://x.fly.dev:16687",
	statement: "A seat is never held by two players at once.",
	symptom: 'it\'s "bad" seat 4 held twice',
	traceId: "4bf92f3577b34da6",
	tests: ["src/seats.test.ts"],
};

const LINK = "vscode://anthropic.claude-code/open?prompt=";

/** The prompt the terminal action sends, with its shell quoting undone. */
function terminalPrompt(): string {
	const a = fixAction(broken, {
		projectRoot: "/p",
		claudeOnPath: true,
		host: "other",
		claudeCodeExtension: false,
	});
	if (!("terminal" in a)) throw new Error("no terminal");
	const m = /^claude '(.*)'$/s.exec(a.terminal.command);
	if (!m) throw new Error("not one quoted word");
	return (m[1] as string).replace(/'\\''/g, "'");
}

describe("fix opens in the Claude Code tab", () => {
	it("A1 — in VS Code with Claude Code installed, opens the link carrying exactly the terminal's prompt", () => {
		const a = fixAction(broken, {
			projectRoot: "/p",
			claudeOnPath: true,
			host: "vscode",
			claudeCodeExtension: true,
		});
		if (!("claudeTab" in a)) throw new Error("no claudeTab");
		expect(a.claudeTab.uri.startsWith(LINK)).toBe(true);
		const prompt = decodeURIComponent(a.claudeTab.uri.slice(LINK.length));
		expect(prompt).toBe(terminalPrompt());
		for (const fact of [
			"seats-held",
			"seat 4 held twice",
			"https://x.fly.dev:16687/trace/4bf92f3577b34da6",
			"src/seats.test.ts",
		]) {
			expect(prompt).toContain(fact);
		}
	});

	it("A1 — opens the tab even when claude is not on the PATH", () => {
		const a = fixAction(broken, {
			projectRoot: "/p",
			claudeOnPath: false,
			host: "vscode",
			claudeCodeExtension: true,
		});
		expect("claudeTab" in a).toBe(true);
	});

	it("A2 — in Cursor, with Claude Code installed, starts claude in a terminal", () => {
		const a = fixAction(broken, {
			projectRoot: "/p",
			claudeOnPath: true,
			host: "other",
			claudeCodeExtension: true,
		});
		expect("terminal" in a).toBe(true);
	});

	it("A2 — in VS Code without the extension, starts claude in a terminal", () => {
		const a = fixAction(broken, {
			projectRoot: "/p",
			claudeOnPath: true,
			host: "vscode",
			claudeCodeExtension: false,
		});
		if (!("terminal" in a)) throw new Error("no terminal");
		expect(a.terminal.cwd).toBe("/p");
		expect(a.terminal.command.startsWith("claude ")).toBe(true);
	});

	it("A2 — with neither the extension nor claude on the PATH, says how to install Claude Code", () => {
		const a = fixAction(broken, {
			projectRoot: "/p",
			claudeOnPath: false,
			host: "vscode",
			claudeCodeExtension: false,
		});
		if (!("message" in a)) throw new Error("no message");
		expect(a.message).toContain("npm install -g @anthropic-ai/claude-code");
	});
});
