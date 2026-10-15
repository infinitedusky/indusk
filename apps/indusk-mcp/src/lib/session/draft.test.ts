import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { draftConversation, draftPrompt, draftSessionPlan } from "./draft.js";

/**
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 *
 * brief-as-the-contract, Build Phase 5: a draft's conversation runs in the
 * draft's own folder under the planner's rules, and asks nothing first.
 */

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "draft-convo-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("a draft's conversation", () => {
	it("runs in the draft folder, as a planning session named for the draft, with the planner's rules beside it", () => {
		const convo = draftConversation({ id: "abc", dir });
		expect(convo.cwd).toBe(dir);
		expect(convo.kind).toBe("planning");
		expect(convo.plan).toBe(draftSessionPlan("abc"));
		expect(existsSync(join(dir, "planner.md"))).toBe(true);
		expect(convo).not.toHaveProperty("addDirs");
	});

	it("asks for no name and no type, writes the draft's documents, and leaves the repository alone", () => {
		const prompt = draftPrompt();
		expect(prompt).toContain("./planner.md");
		expect(prompt).toMatch(/Ask for no name and no type/);
		expect(prompt).toContain("./brief.md");
		expect(prompt).toContain("./proposal.json");
		expect(prompt).toMatch(/touch nothing in the project/);
	});

	it("a reopened one reads what it holds, and the person's words come last", () => {
		const prompt = draftPrompt({ reopened: true, firstMessage: "a phone nav" });
		expect(prompt).toMatch(/reopened/);
		expect(prompt).not.toMatch(/ask the person to describe/);
		expect(prompt.endsWith("a phone nav")).toBe(true);
	});
});
