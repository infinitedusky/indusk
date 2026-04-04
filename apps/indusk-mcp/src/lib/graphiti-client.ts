import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getInfraConfig } from "./infra-config.js";

interface AddEpisodeOptions {
	groupId?: string;
	source?: string;
	sourceDescription?: string;
}

interface SearchOptions {
	groupIds?: string[];
	maxResults?: number;
}

interface GraphitiNode {
	name: string;
	uuid: string;
	summary: string;
	group_id: string;
	[key: string]: unknown;
}

interface GraphitiFact {
	uuid: string;
	fact: string;
	valid_at: string | null;
	invalid_at: string | null;
	[key: string]: unknown;
}

/**
 * MCP client wrapper for the Graphiti temporal knowledge graph.
 *
 * Connects to the Graphiti MCP server running inside the indusk-infra container.
 * Lazy connection — connects on first call, not at construction.
 * Graceful degradation — returns null/empty on connection failure, never throws.
 */
export class GraphitiClient {
	private client: Client | null = null;
	private transport: StreamableHTTPClientTransport | null = null;
	private connected = false;
	private connecting: Promise<boolean> | null = null;
	private serverUrl: string;
	private projectName: string;

	constructor(projectName: string, serverUrl?: string) {
		this.projectName = projectName;
		this.serverUrl = serverUrl ?? getInfraConfig().graphiti.url;
	}

	/**
	 * Lazily connect to the Graphiti MCP server.
	 * Returns true if connected, false if connection failed.
	 * Multiple concurrent calls share the same connection attempt.
	 */
	async connect(): Promise<boolean> {
		if (this.connected) return true;
		if (this.connecting) return this.connecting;

		this.connecting = this.doConnect();
		const result = await this.connecting;
		this.connecting = null;
		return result;
	}

	private async doConnect(): Promise<boolean> {
		try {
			// Normalize URL — Graphiti redirects /mcp/ to /mcp
			const url = this.serverUrl.endsWith("/") ? this.serverUrl.slice(0, -1) : this.serverUrl;

			this.transport = new StreamableHTTPClientTransport(new URL(url));
			this.client = new Client({ name: "indusk-mcp", version: "1.0.0" });
			await this.client.connect(this.transport);
			this.connected = true;
			return true;
		} catch {
			this.client = null;
			this.transport = null;
			this.connected = false;
			return false;
		}
	}

	private getClient(): Client {
		if (!this.client) throw new Error("Not connected");
		return this.client;
	}

	/**
	 * Add an episode to the knowledge graph.
	 *
	 * @param name - Short name for the episode (e.g., "auth-refactor decision")
	 * @param body - Episode content to extract entities and facts from
	 * @param options - groupId defaults to project name, source defaults to "text"
	 * @returns Success response or null on failure
	 */
	async addEpisode(
		name: string,
		body: string,
		options?: AddEpisodeOptions,
	): Promise<{ success: boolean } | null> {
		if (!(await this.connect())) return null;

		try {
			const result = await this.getClient().callTool({
				name: "add_memory",
				arguments: {
					name,
					episode_body: body,
					group_id: options?.groupId ?? this.projectName,
					source: options?.source ?? "text",
					source_description: options?.sourceDescription ?? "",
				},
			});
			return { success: !result.isError };
		} catch {
			return null;
		}
	}

	/**
	 * Search for entity nodes in the knowledge graph.
	 *
	 * @param query - Natural language search query
	 * @param options - groupIds defaults to [projectName, "shared"] for cross-group search
	 * @returns Array of matching nodes, or empty array on failure
	 */
	async searchNodes(query: string, options?: SearchOptions): Promise<GraphitiNode[]> {
		if (!(await this.connect())) return [];

		const groupIds = this.resolveGroupIds(options?.groupIds);

		try {
			const result = await this.getClient().callTool({
				name: "search_nodes",
				arguments: {
					query,
					group_ids: groupIds,
					max_nodes: options?.maxResults ?? 10,
				},
			});
			if (result.isError) return [];
			const content = result.content as Array<{ type: string; text?: string }>;
			const text = content?.[0];
			if (text?.text) {
				const parsed = JSON.parse(text.text);
				return parsed.nodes ?? parsed ?? [];
			}
			return [];
		} catch {
			return [];
		}
	}

	/**
	 * Search for facts (relationships between entities) in the knowledge graph.
	 *
	 * @param query - Natural language search query
	 * @param options - groupIds defaults to [projectName, "shared"] for cross-group search
	 * @returns Array of matching facts, or empty array on failure
	 */
	async searchFacts(query: string, options?: SearchOptions): Promise<GraphitiFact[]> {
		if (!(await this.connect())) return [];

		const groupIds = this.resolveGroupIds(options?.groupIds);

		try {
			const result = await this.getClient().callTool({
				name: "search_memory_facts",
				arguments: {
					query,
					group_ids: groupIds,
					max_facts: options?.maxResults ?? 10,
				},
			});
			if (result.isError) return [];
			const content = result.content as Array<{ type: string; text?: string }>;
			const text = content?.[0];
			if (text?.text) {
				const parsed = JSON.parse(text.text);
				return parsed.facts ?? parsed ?? [];
			}
			return [];
		} catch {
			return [];
		}
	}

	/**
	 * Check if the Graphiti server is reachable and healthy.
	 *
	 * @returns Status object or null if unreachable
	 */
	async getStatus(): Promise<{ status: string } | null> {
		if (!(await this.connect())) return null;

		try {
			const result = await this.getClient().callTool({
				name: "get_status",
				arguments: {},
			});
			if (result.isError) return null;
			const content = result.content as Array<{ type: string; text?: string }>;
			const text = content?.[0];
			if (text?.text) {
				return JSON.parse(text.text);
			}
			return null;
		} catch {
			return null;
		}
	}

	/**
	 * Resolve group IDs for search — always includes "shared" for cross-group search.
	 * If caller provides groupIds, uses those. Otherwise defaults to [projectName, "shared"].
	 * Deduplicates "shared" if already present.
	 */
	private resolveGroupIds(groupIds?: string[]): string[] {
		const ids = groupIds ?? [this.projectName];
		if (!ids.includes("shared")) {
			ids.push("shared");
		}
		return ids;
	}

	/**
	 * Disconnect from the Graphiti MCP server.
	 */
	async disconnect(): Promise<void> {
		if (this.client) {
			try {
				await this.client.close();
			} catch {
				// ignore
			}
		}
		this.client = null;
		this.transport = null;
		this.connected = false;
	}
}
