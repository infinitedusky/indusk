import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContextTools } from "../tools/context-tools.js";
import { registerDocumentTools } from "../tools/document-tools.js";
import { registerGraphTools } from "../tools/graph-tools.js";
import { registerPlanTools } from "../tools/plan-tools.js";
import { registerQualityTools } from "../tools/quality-tools.js";
import { registerSystemTools } from "../tools/system-tools.js";

export async function startServer(): Promise<void> {
	const projectRoot = resolve(process.env.PROJECT_ROOT ?? ".");

	const server = new McpServer({
		name: "indusk",
		version: "0.1.0",
	});

	registerPlanTools(server, projectRoot);
	registerContextTools(server, projectRoot);
	registerQualityTools(server, projectRoot);
	registerDocumentTools(server, projectRoot);
	registerSystemTools(server, projectRoot);
	registerGraphTools(server, projectRoot);

	const transport = new StdioServerTransport();
	await server.connect(transport);
}
