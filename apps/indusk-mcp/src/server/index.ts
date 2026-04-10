process.on("uncaughtException", (err) => {
	console.error(`[indusk] uncaught exception: ${err.message}`);
	if (err.stack) console.error(err.stack);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	console.error(`[indusk] unhandled rejection: ${reason}`);
	process.exit(1);
});

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerContextTools } from "../tools/context-tools.js";
import { registerDocumentTools } from "../tools/document-tools.js";
import { registerGraphTools } from "../tools/graph-tools.js";
import { registerLessonTools } from "../tools/lesson-tools.js";
import { registerPlanTools } from "../tools/plan-tools.js";
import { registerQualityTools } from "../tools/quality-tools.js";
import { registerSystemTools } from "../tools/system-tools.js";

function getLocalVersion(): string {
	try {
		const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");
		return JSON.parse(readFileSync(pkgPath, "utf-8")).version;
	} catch {
		return "unknown";
	}
}

function checkForUpdates(currentVersion: string): void {
	fetch("https://registry.npmjs.org/@infinitedusky/indusk-mcp/latest")
		.then((res) => res.json())
		.then((data: { version?: string }) => {
			if (data.version && data.version !== currentVersion) {
				console.error(
					`[indusk] Update available: ${currentVersion} → ${data.version}. Run: npm i -g @infinitedusky/indusk-mcp@latest`,
				);
			}
		})
		.catch(() => {});
}

export async function startServer(): Promise<void> {
	const projectRoot = resolve(process.env.PROJECT_ROOT ?? ".");
	const version = getLocalVersion();

	console.error(`[indusk] v${version} starting (project: ${projectRoot})`);

	// Non-blocking version check
	checkForUpdates(version);

	try {
		const server = new McpServer({
			name: "indusk",
			version,
		});

		console.error("[indusk] registering tools...");
		registerPlanTools(server, projectRoot);
		registerContextTools(server, projectRoot);
		registerQualityTools(server, projectRoot);
		registerDocumentTools(server, projectRoot);
		registerSystemTools(server, projectRoot);
		registerGraphTools(server, projectRoot);
		registerLessonTools(server, projectRoot);
		console.error("[indusk] tools registered");

		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error("[indusk] connected via stdio");
	} catch (err) {
		console.error(`[indusk] FATAL: ${err instanceof Error ? err.message : String(err)}`);
		if (err instanceof Error && err.stack) {
			console.error(err.stack);
		}
		process.exit(1);
	}
}
