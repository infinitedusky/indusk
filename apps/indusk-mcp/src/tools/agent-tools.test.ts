import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCurrentMd } from "../lib/agents/current-md.js";
import { registerAgentTools } from "./agent-tools.js";

/**
 * T5 from the handoff-multi-agent-section-shape trajectory:
 *   "The agent updates its in-flight / open-questions / cursor content via a
 *    single structured MCP tool call."
 *
 * Tests the `update_current_section` tool wrapper: input shape, atomic
 * read-modify-write of .indusk/current.md, upsertSection composition.
 */

interface RegisteredTool {
	name: string;
	spec: unknown;
	handler: (
		input: Record<string, unknown>,
	) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

class MockMcpServer {
	public readonly registered: RegisteredTool[] = [];

	registerTool(name: string, spec: unknown, handler: RegisteredTool["handler"]): void {
		this.registered.push({ name, spec, handler });
	}

	find(name: string): RegisteredTool | undefined {
		return this.registered.find((t) => t.name === name);
	}
}

let projectRoot: string;

beforeEach(() => {
	projectRoot = join(
		tmpdir(),
		`agent-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
});

afterEach(() => {
	rmSync(projectRoot, { recursive: true, force: true });
});

describe("T5 — mcp tool update_current_section", () => {
	it("registers the update_current_section tool on the server", () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerAgentTools(server as any, projectRoot);
		const names = server.registered.map((t) => t.name);
		expect(names).toContain("update_current_section");
	});

	it("creates current.md when none exists and writes the agent's section", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerAgentTools(server as any, projectRoot);
		const tool = server.find("update_current_section");
		expect(tool).toBeDefined();

		const result = await tool?.handler({
			sessionId: "2c87e7b6-702a-4dcd-876f-a31820e0df3e",
			task: "auth refactor",
			sections: {
				in_flight: "working on middleware",
				open_questions: "jwt or cookies?",
				cursor: "auth.ts:42",
			},
		});

		expect(result?.content[0].type).toBe("text");
		const parsedResult = JSON.parse(result?.content[0].text ?? "{}");
		expect(parsedResult.ok).toBe(true);
		expect(parsedResult.sessionId).toBe("2c87e7b6-702a-4dcd-876f-a31820e0df3e");

		const path = join(projectRoot, ".indusk/current.md");
		expect(existsSync(path)).toBe(true);
		const content = readFileSync(path, "utf-8");
		const doc = parseCurrentMd(content);
		expect(doc.sections).toHaveLength(1);
		expect(doc.sections[0].sessionId).toBe("2c87e7b6-702a-4dcd-876f-a31820e0df3e");
		expect(doc.sections[0].task).toBe("auth refactor");
		expect(doc.sections[0].inFlight).toBe("working on middleware");
		expect(doc.sections[0].openQuestions).toBe("jwt or cookies?");
		expect(doc.sections[0].cursor).toBe("auth.ts:42");
	});

	it("upserts in place — second call with same sessionId replaces, doesn't append", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerAgentTools(server as any, projectRoot);
		const tool = server.find("update_current_section");

		await tool?.handler({
			sessionId: "uuid-stable",
			task: "first",
			sections: { in_flight: "v1", open_questions: "", cursor: "" },
		});
		await tool?.handler({
			sessionId: "uuid-stable",
			task: "first",
			sections: { in_flight: "v2", open_questions: "new q", cursor: "new c" },
		});

		const content = readFileSync(join(projectRoot, ".indusk/current.md"), "utf-8");
		const doc = parseCurrentMd(content);
		expect(doc.sections).toHaveLength(1);
		expect(doc.sections[0].inFlight).toBe("v2");
		expect(doc.sections[0].openQuestions).toBe("new q");
	});

	it("preserves other agents' sections when one calls the tool", async () => {
		// Seed current.md with an existing section from another agent
		const seedPath = join(projectRoot, ".indusk/current.md");
		const seedContent = `# Operational State

## Project (shared)

(empty)

---

## Session uuid-oth — other agent

**Session ID**: uuid-other
**Last updated**: 2026-06-26T10:00:00Z

### In Flight

other agent's work

### Open Questions

(empty)

### Cursor

(empty)

---
`;
		writeFileSync(seedPath, seedContent);

		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerAgentTools(server as any, projectRoot);
		const tool = server.find("update_current_section");

		await tool?.handler({
			sessionId: "uuid-mine",
			task: "my work",
			sections: { in_flight: "mine", open_questions: "", cursor: "" },
		});

		const content = readFileSync(seedPath, "utf-8");
		const doc = parseCurrentMd(content);
		expect(doc.sections).toHaveLength(2);
		const other = doc.sections.find((s) => s.sessionId === "uuid-other");
		const mine = doc.sections.find((s) => s.sessionId === "uuid-mine");
		expect(other?.inFlight).toBe("other agent's work");
		expect(mine?.inFlight).toBe("mine");
	});

	it("rejects path-traversal session IDs via the sanitizer (T12 regression)", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerAgentTools(server as any, projectRoot);
		const tool = server.find("update_current_section");

		await expect(
			tool?.handler({
				sessionId: "../escaped",
				task: "evil",
				sections: { in_flight: "", open_questions: "", cursor: "" },
			}),
		).rejects.toThrow(/session id/i);
	});
});
