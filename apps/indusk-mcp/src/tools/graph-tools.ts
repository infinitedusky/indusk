import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function cgcPath(): string | null {
	const paths = [join(process.env.HOME ?? "", ".local/bin/cgc"), "/usr/local/bin/cgc"];
	return paths.find((p) => existsSync(p)) ?? null;
}

function runCgc(args: string, projectRoot: string): string {
	const cgc = cgcPath();
	if (!cgc) {
		return JSON.stringify({ error: "CGC not installed — run: pipx install codegraphcontext" });
	}

	try {
		return execSync(`${cgc} ${args}`, {
			encoding: "utf-8",
			timeout: 60000,
			stdio: ["ignore", "pipe", "pipe"],
			cwd: projectRoot,
			env: {
				...process.env,
				DATABASE_TYPE: "falkordb-remote",
				FALKORDB_HOST: process.env.FALKORDB_HOST ?? "localhost",
				FALKORDB_PORT: process.env.FALKORDB_PORT ?? "6379",
				FALKORDB_GRAPH_NAME: process.env.FALKORDB_GRAPH_NAME ?? basename(projectRoot),
			},
		}).trim();
	} catch (err: unknown) {
		const execErr = err as { stderr?: string; message?: string };
		return JSON.stringify({
			error: execErr.stderr?.trim() || execErr.message || "CGC command failed",
		});
	}
}

export function indexProject(projectRoot: string): { success: boolean; output: string } {
	const cgc = cgcPath();
	if (!cgc) {
		return { success: false, output: "CGC not installed — run: pipx install codegraphcontext" };
	}

	const graphName = process.env.FALKORDB_GRAPH_NAME ?? basename(projectRoot);

	try {
		// Check if .cgcignore exists
		const hasIgnore = existsSync(join(projectRoot, ".cgcignore"));

		const output = execSync(`${cgc} index ${projectRoot}`, {
			encoding: "utf-8",
			timeout: 120000,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				DATABASE_TYPE: "falkordb-remote",
				FALKORDB_HOST: process.env.FALKORDB_HOST ?? "localhost",
				FALKORDB_PORT: process.env.FALKORDB_PORT ?? "6379",
				FALKORDB_GRAPH_NAME: graphName,
			},
		}).trim();

		return {
			success: true,
			output: `Indexed into graph '${graphName}'${hasIgnore ? " (with .cgcignore)" : " (no .cgcignore — consider creating one)"}. ${output}`,
		};
	} catch (err: unknown) {
		const execErr = err as { stderr?: string; message?: string };
		return {
			success: false,
			output: execErr.stderr?.trim() || execErr.message || "Index failed",
		};
	}
}

export function registerGraphTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"index_project",
		{
			description:
				"Index the project codebase into the code graph. Run this after init or when the codebase has changed significantly. Uses CGC under the hood.",
		},
		async () => {
			const result = indexProject(projectRoot);
			return {
				content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
				isError: !result.success,
			};
		},
	);

	server.registerTool(
		"query_dependencies",
		{
			description:
				"Query what depends on a file or module, and what it depends on. Use BEFORE modifying any file to understand blast radius.",
			inputSchema: {
				target: z.string().describe("File path, function name, or module to query"),
				direction: z
					.enum(["dependents", "dependencies", "both"])
					.default("both")
					.describe(
						"Direction: what depends on this (dependents), what this depends on (dependencies), or both",
					),
			},
		},
		async ({ target, direction }) => {
			let query: string;
			if (direction === "dependents") {
				query = `MATCH (dependent)-[r]->(target) WHERE target.name CONTAINS '${target}' RETURN dependent.name as dependent, type(r) as relationship, target.name as target`;
			} else if (direction === "dependencies") {
				query = `MATCH (source)-[r]->(dep) WHERE source.name CONTAINS '${target}' RETURN source.name as source, type(r) as relationship, dep.name as dependency`;
			} else {
				query = `MATCH (a)-[r]-(b) WHERE a.name CONTAINS '${target}' RETURN a.name as source, type(r) as relationship, b.name as related ORDER BY relationship`;
			}

			const output = runCgc(`query "${query}"`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"query_graph",
		{
			description:
				"Run a custom Cypher query against the code graph. Use for advanced structural queries not covered by query_dependencies.",
			inputSchema: {
				cypher: z.string().describe("Cypher query to execute (read-only)"),
			},
		},
		async ({ cypher }) => {
			const output = runCgc(`query "${cypher}"`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);
}
