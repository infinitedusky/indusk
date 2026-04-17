import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerHighlightTools } from "./highlight-tools.js";

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
		`highlight-tools-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	mkdirSync(join(projectRoot, ".indusk"), { recursive: true });
});

afterEach(() => {
	rmSync(projectRoot, { recursive: true, force: true });
});

describe("T5: highlight MCP tool is registered and calls writeHighlight with tag/note/level", () => {
	it("registers all three highlight tools on the server", () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerHighlightTools(server as any, projectRoot);
		const names = server.registered.map((t) => t.name).sort();
		expect(names).toEqual(["highlight", "highlight_mark_processed", "highlights_unprocessed"]);
	});

	it("the `highlight` tool handler writes to .indusk/highlights.jsonl with the given inputs", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerHighlightTools(server as any, projectRoot);
		const tool = server.find("highlight");
		expect(tool).toBeDefined();

		const result = await tool?.handler({
			tag: "brief-accepted",
			note: "agent-roles brief accepted on 2026-04-15",
			level: "critical",
		});

		// Result is a stringified Highlight
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.tag).toBe("brief-accepted");
		expect(parsed.note).toBe("agent-roles brief accepted on 2026-04-15");
		expect(parsed.level).toBe("critical");
		expect(parsed.id).toMatch(/^h-\d{8}-\d{3}$/);

		// File now exists with the entry
		const path = join(projectRoot, ".indusk", "highlights.jsonl");
		expect(existsSync(path)).toBe(true);
		const lines = readFileSync(path, "utf-8")
			.split("\n")
			.filter((l) => l.length > 0);
		expect(lines.length).toBe(1);
		expect(JSON.parse(lines[0]).id).toBe(parsed.id);
	});

	it("the `highlights_unprocessed` tool returns what the working agent just wrote", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerHighlightTools(server as any, projectRoot);

		await server.find("highlight")?.handler({
			tag: "correction",
			note: "use pnpm ce, not npx",
			level: "important",
		});

		const unprocessed = await server.find("highlights_unprocessed")?.handler({});
		const list = JSON.parse(unprocessed.content[0].text);
		expect(list.length).toBe(1);
		expect(list[0].tag).toBe("correction");
	});

	it("the `highlight_mark_processed` tool removes the highlight from subsequent unprocessed reads", async () => {
		const server = new MockMcpServer();
		// biome-ignore lint/suspicious/noExplicitAny: test double
		registerHighlightTools(server as any, projectRoot);

		const write = await server.find("highlight")?.handler({
			tag: "retro-lesson",
			note: "front-load format decisions",
			level: "important",
		});
		const { id } = JSON.parse(write.content[0].text);

		await server.find("highlight_mark_processed")?.handler({
			id,
			action: "wrote-episode",
			detail: "retro-agent-roles-2",
		});

		const unprocessed = await server.find("highlights_unprocessed")?.handler({});
		const list = JSON.parse(unprocessed.content[0].text);
		expect(list.length).toBe(0);
	});
});
