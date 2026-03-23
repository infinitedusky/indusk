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
				FALKORDB_HOST: process.env.FALKORDB_HOST ?? "falkordb.orb.local",
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
				FALKORDB_HOST: process.env.FALKORDB_HOST ?? "falkordb.orb.local",
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
				"Index the project codebase into the code graph. Run this after init or when the codebase has changed significantly.",
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

	server.registerTool(
		"graph_visualize",
		{
			description:
				"Launch the interactive code graph visualization in the browser. Shows nodes (files, functions, classes) and relationships (calls, imports, inherits). Use when the user wants to see or explore the code graph visually.",
		},
		async () => {
			const cgc = cgcPath();
			if (!cgc) {
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify({ error: "CGC not installed" }) },
					],
					isError: true,
				};
			}

			try {
				execSync(`${cgc} visualize --port 8111 &`, {
					encoding: "utf-8",
					timeout: 5000,
					stdio: ["ignore", "pipe", "pipe"],
					cwd: projectRoot,
					env: {
						...process.env,
						DATABASE_TYPE: "falkordb-remote",
						FALKORDB_HOST: process.env.FALKORDB_HOST ?? "falkordb.orb.local",
						FALKORDB_GRAPH_NAME: process.env.FALKORDB_GRAPH_NAME ?? basename(projectRoot),
					},
				});
			} catch {
				// visualize runs in background, the timeout catch is expected
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								url: "http://localhost:8111",
								message:
									"Code graph visualization started at http://localhost:8111 — open in browser",
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"graph_doctor",
		{
			description:
				"Run CGC diagnostics to check database connection, configuration, and system health. Use when graph tools return errors or when debugging graph issues.",
		},
		async () => {
			const output = runCgc("doctor", projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_find_dead_code",
		{
			description:
				"Find potentially unused functions (dead code) across the indexed codebase. Useful for cleanup and refactoring.",
		},
		async () => {
			const output = runCgc("analyze dead-code", projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_complexity",
		{
			description:
				"Find the most complex functions in the codebase by cyclomatic complexity. Useful for identifying refactoring targets.",
			inputSchema: {
				limit: z.number().default(10).describe("Number of results to return"),
			},
		},
		async ({ limit }) => {
			const output = runCgc(`analyze complexity --limit ${limit}`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_callers",
		{
			description:
				"Find all functions that call a given function. Use to understand impact before modifying a function.",
			inputSchema: {
				function_name: z.string().describe("Name of the function to find callers for"),
			},
		},
		async ({ function_name }) => {
			const output = runCgc(`analyze callers "${function_name}"`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_callees",
		{
			description:
				"Find all functions that a given function calls. Use to understand what a function depends on.",
			inputSchema: {
				function_name: z.string().describe("Name of the function to find callees for"),
			},
		},
		async ({ function_name }) => {
			const output = runCgc(`analyze calls "${function_name}"`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_find",
		{
			description:
				"Search the code graph for functions, classes, or modules by name or content. Faster than grep for structural queries.",
			inputSchema: {
				query: z.string().describe("Name or keyword to search for"),
				type: z
					.enum(["name", "pattern", "content"])
					.default("name")
					.describe("Search type: exact name, substring pattern, or content search"),
			},
		},
		async ({ query, type }) => {
			const output = runCgc(`find ${type} "${query}"`, projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);

	server.registerTool(
		"graph_watch",
		{
			description:
				"Start watching the project directory for file changes and auto-update the graph. Keeps the graph current without manual re-indexing.",
		},
		async () => {
			const cgc = cgcPath();
			if (!cgc) {
				return {
					content: [
						{ type: "text" as const, text: JSON.stringify({ error: "CGC not installed" }) },
					],
					isError: true,
				};
			}

			try {
				execSync(`${cgc} watch ${projectRoot} &`, {
					encoding: "utf-8",
					timeout: 5000,
					stdio: ["ignore", "pipe", "pipe"],
					cwd: projectRoot,
					env: {
						...process.env,
						DATABASE_TYPE: "falkordb-remote",
						FALKORDB_HOST: process.env.FALKORDB_HOST ?? "falkordb.orb.local",
						FALKORDB_GRAPH_NAME: process.env.FALKORDB_GRAPH_NAME ?? basename(projectRoot),
					},
				});
			} catch {
				// watch runs in background
			}

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								success: true,
								message: `Watching ${projectRoot} for changes — graph will auto-update`,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);

	server.registerTool(
		"graph_stats",
		{
			description:
				"Get statistics about the indexed codebase: file count, function count, class count, module count.",
		},
		async () => {
			const output = runCgc("stats", projectRoot);
			return {
				content: [{ type: "text" as const, text: output }],
			};
		},
	);
}
