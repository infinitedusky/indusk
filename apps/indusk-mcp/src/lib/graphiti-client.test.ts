import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphitiClient } from "./graphiti-client.js";

const callToolMock = vi.fn().mockResolvedValue({
	isError: false,
	content: [{ type: "text", text: '{"success": true}' }],
});
const connectMock = vi.fn().mockResolvedValue(undefined);
const closeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
	return {
		Client: class MockClient {
			connect = connectMock;
			callTool = callToolMock;
			close = closeMock;
		},
	};
});

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => {
	return {
		StreamableHTTPClientTransport: class MockTransport {},
	};
});

vi.mock("./infra-config.js", () => ({
	getInfraConfig: () => ({
		falkordb: { host: "localhost", port: 6379 },
		graphiti: { url: "http://localhost:8100/mcp" },
	}),
}));

describe("GraphitiClient", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("addEpisode formats arguments correctly with group_id", async () => {
		const client = new GraphitiClient("test-project");
		const result = await client.addEpisode("test episode", "some content");

		expect(result).toEqual({ success: true });
		expect(callToolMock).toHaveBeenCalledWith({
			name: "add_memory",
			arguments: {
				name: "test episode",
				episode_body: "some content",
				group_id: "test-project",
				source: "text",
				source_description: "",
			},
		});
		await client.disconnect();
	});

	it("addEpisode uses custom groupId when provided", async () => {
		const client = new GraphitiClient("test-project");
		await client.addEpisode("test", "content", { groupId: "shared" });

		expect(callToolMock).toHaveBeenCalledWith(
			expect.objectContaining({
				arguments: expect.objectContaining({
					group_id: "shared",
				}),
			}),
		);
		await client.disconnect();
	});

	it("searchNodes includes both project and shared group_ids", async () => {
		callToolMock.mockResolvedValueOnce({
			isError: false,
			content: [
				{
					type: "text",
					text: JSON.stringify({
						nodes: [{ name: "test", uuid: "1", summary: "s", group_id: "myproject" }],
					}),
				},
			],
		});

		const client = new GraphitiClient("myproject");
		await client.searchNodes("test query");

		expect(callToolMock).toHaveBeenCalledWith({
			name: "search_nodes",
			arguments: {
				query: "test query",
				group_ids: ["myproject", "shared"],
				max_nodes: 10,
			},
		});
		await client.disconnect();
	});

	it("searchFacts includes both project and shared group_ids", async () => {
		callToolMock.mockResolvedValueOnce({
			isError: false,
			content: [
				{
					type: "text",
					text: JSON.stringify({
						facts: [{ uuid: "1", fact: "test fact", valid_at: null, invalid_at: null }],
					}),
				},
			],
		});

		const client = new GraphitiClient("myproject");
		await client.searchFacts("test query");

		expect(callToolMock).toHaveBeenCalledWith({
			name: "search_memory_facts",
			arguments: {
				query: "test query",
				group_ids: ["myproject", "shared"],
				max_facts: 10,
			},
		});
		await client.disconnect();
	});

	it("connection failure returns graceful fallback", async () => {
		connectMock.mockRejectedValue(new Error("connection refused"));

		const client = new GraphitiClient("test");
		const episode = await client.addEpisode("test", "content");
		const nodes = await client.searchNodes("query");
		const facts = await client.searchFacts("query");
		const status = await client.getStatus();

		expect(episode).toBeNull();
		expect(nodes).toEqual([]);
		expect(facts).toEqual([]);
		expect(status).toBeNull();
		await client.disconnect();

		// Restore default for other tests
		connectMock.mockResolvedValue(undefined);
	});

	it("lazy connection only connects once", async () => {
		const client = new GraphitiClient("test");
		await client.addEpisode("a", "b");
		await client.addEpisode("c", "d");
		await client.searchNodes("query");

		expect(connectMock).toHaveBeenCalledTimes(1);
		await client.disconnect();
	});

	it("searchNodes with 'shared' groupId does not duplicate", async () => {
		callToolMock.mockResolvedValueOnce({
			isError: false,
			content: [{ type: "text", text: '{"nodes": []}' }],
		});

		const client = new GraphitiClient("test");
		await client.searchNodes("query", { groupIds: ["myproject", "shared"] });

		expect(callToolMock).toHaveBeenCalledWith(
			expect.objectContaining({
				arguments: expect.objectContaining({
					group_ids: ["myproject", "shared"],
				}),
			}),
		);

		const args = callToolMock.mock.calls[0][0].arguments;
		expect(args.group_ids.filter((id: string) => id === "shared")).toHaveLength(1);
		await client.disconnect();
	});
});
