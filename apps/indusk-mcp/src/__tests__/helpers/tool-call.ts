import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Call an MCP tool the way a client would, without a transport.
 *
 * A stub server captures every handler a `register*Tools` function passes to
 * `registerTool`; `call` invokes one by name with its arguments and returns
 * the text the client would receive, parsed as JSON. The tools are the
 * boundary under test, so nothing here reaches past them.
 */

type Handler = (args: Record<string, unknown>) => Promise<{
	content: { type: string; text: string }[];
	isError?: boolean;
}>;

export interface ToolCaller {
	/** The tool's text result, parsed as JSON, and whether it was flagged as an error. */
	call(name: string, args?: Record<string, unknown>): Promise<{ json: unknown; isError: boolean }>;
}

export function toolCaller(register: (server: McpServer) => void): ToolCaller {
	const handlers = new Map<string, Handler>();
	const stub = {
		registerTool(name: string, _def: unknown, handler: Handler) {
			handlers.set(name, handler);
		},
	};
	register(stub as unknown as McpServer);
	return {
		async call(name, args = {}) {
			const handler = handlers.get(name);
			if (!handler) throw new Error(`tool-call: no tool registered as "${name}"`);
			const result = await handler(args);
			const text = result.content.map((c) => c.text).join("");
			return { json: JSON.parse(text), isError: result.isError === true };
		},
	};
}
