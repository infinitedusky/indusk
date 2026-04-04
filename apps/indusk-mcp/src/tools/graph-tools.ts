import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

function getCgcGraphName(projectRoot: string): string {
	if (process.env.FALKORDB_GRAPH_NAME) return process.env.FALKORDB_GRAPH_NAME;
	return `cgc-${basename(projectRoot)}`;
}

function cgcPath(): string | null {
	const paths = [join(process.env.HOME ?? "", ".local/bin/cgc"), "/usr/local/bin/cgc"];
	return paths.find((p) => existsSync(p)) ?? null;
}

function getFalkorHost(): string {
	if (process.env.FALKORDB_HOST) return process.env.FALKORDB_HOST;
	return "localhost";
}

function checkFalkorConnection(host: string): boolean {
	try {
		// Fast TCP check — try to connect to Redis port
		execSync(
			`node -e "const s=require('net').connect(6379,'${host}');s.setTimeout(2000);s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>process.exit(1))"`,
			{ timeout: 3000, stdio: ["ignore", "ignore", "ignore"] },
		);
		return true;
	} catch {
		return false;
	}
}

function runCgc(
	args: string,
	projectRoot: string,
	options?: { timeout?: number; skipConnectionCheck?: boolean },
): string {
	const cgc = cgcPath();
	if (!cgc) {
		return JSON.stringify({ error: "CGC not installed — run: pipx install codegraphcontext" });
	}

	const host = getFalkorHost();
	const timeout = options?.timeout ?? 15000;

	// Fast pre-check: is FalkorDB reachable?
	if (!options?.skipConnectionCheck && !checkFalkorConnection(host)) {
		return JSON.stringify({
			error: `FalkorDB not reachable at ${host}:6379. Is the indusk-infra container running? Try: docker start indusk-infra`,
			host,
			suggestion: "Try: docker start indusk-infra — or run: indusk infra start",
		});
	}

	try {
		return execSync(`${cgc} ${args}`, {
			encoding: "utf-8",
			timeout,
			stdio: ["ignore", "pipe", "pipe"],
			cwd: projectRoot,
			env: {
				...process.env,
				DATABASE_TYPE: "falkordb-remote",
				FALKORDB_HOST: host,
				FALKORDB_GRAPH_NAME: getCgcGraphName(projectRoot),
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

	const host = getFalkorHost();
	if (!checkFalkorConnection(host)) {
		return {
			success: false,
			output: `FalkorDB not reachable at ${host}:6379. Is the indusk-infra container running? Try: docker start indusk-infra`,
		};
	}

	const graphName = getCgcGraphName(projectRoot);
	const hasIgnore = existsSync(join(projectRoot, ".cgcignore"));

	try {
		const output = execSync(`${cgc} index ${projectRoot}`, {
			encoding: "utf-8",
			timeout: 120000,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				DATABASE_TYPE: "falkordb-remote",
				FALKORDB_HOST: host,
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
						FALKORDB_HOST: process.env.FALKORDB_HOST ?? "localhost",
						FALKORDB_GRAPH_NAME: getCgcGraphName(projectRoot),
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
						FALKORDB_HOST: process.env.FALKORDB_HOST ?? "localhost",
						FALKORDB_GRAPH_NAME: getCgcGraphName(projectRoot),
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

	server.registerTool(
		"graph_ensure",
		{
			description:
				"Validate and fix the entire code graph stack: FalkorDB container, CGC connection, repo indexing. Call this during catchup or when graph tools fail. Attempts auto-repair for common issues.",
		},
		async () => {
			const steps: { step: string; status: "ok" | "fixed" | "error"; detail: string }[] = [];

			// 1. Check CGC installed
			const cgc = cgcPath();
			if (!cgc) {
				steps.push({
					step: "cgc-installed",
					status: "error",
					detail: "CGC not installed — run: pipx install codegraphcontext",
				});
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ steps }, null, 2) }],
					isError: true,
				};
			}
			steps.push({ step: "cgc-installed", status: "ok", detail: cgc });

			// 2. Check FalkorDB container exists and is running
			try {
				const status = execSync("docker ps --filter name=indusk-infra --format '{{.Status}}'", {
					encoding: "utf-8",
					timeout: 5000,
					stdio: ["ignore", "pipe", "pipe"],
				}).trim();

				if (status) {
					steps.push({ step: "falkordb-container", status: "ok", detail: status });
				} else {
					// Container exists but not running — try to start
					try {
						execSync("docker start indusk-infra", {
							timeout: 10000,
							stdio: ["ignore", "pipe", "pipe"],
						});
						steps.push({
							step: "falkordb-container",
							status: "fixed",
							detail: "Started existing container",
						});
					} catch {
						steps.push({
							step: "falkordb-container",
							status: "error",
							detail:
								"indusk-infra container not found — run: indusk infra start (or docker run -d --name indusk-infra -p 6379:6379 -p 8100:8100 -v indusk-data:/data indusk-infra)",
						});
					}
				}
			} catch {
				steps.push({
					step: "falkordb-container",
					status: "error",
					detail: "Docker not available — is OrbStack running?",
				});
			}

			// 3. Check connectivity
			const host = getFalkorHost();
			if (checkFalkorConnection(host)) {
				steps.push({
					step: "falkordb-connection",
					status: "ok",
					detail: `Connected to ${host}:6379`,
				});
			} else {
				// Wait a moment if we just started the container
				const justStarted = steps.some(
					(s) => s.step === "falkordb-container" && s.status === "fixed",
				);
				if (justStarted) {
					await new Promise((r) => setTimeout(r, 3000));
					if (checkFalkorConnection(host)) {
						steps.push({
							step: "falkordb-connection",
							status: "ok",
							detail: `Connected to ${host}:6379 (after wait)`,
						});
					} else {
						steps.push({
							step: "falkordb-connection",
							status: "error",
							detail: `Cannot connect to ${host}:6379`,
						});
					}
				} else {
					steps.push({
						step: "falkordb-connection",
						status: "error",
						detail: `Cannot connect to ${host}:6379`,
					});
				}
			}

			// 4. Check if repo is indexed
			if (steps.every((s) => s.status !== "error")) {
				const listOutput = runCgc("list", projectRoot, { skipConnectionCheck: true });
				if (
					listOutput.includes(projectRoot) ||
					listOutput.includes(basename(projectRoot)) ||
					listOutput.includes(getCgcGraphName(projectRoot))
				) {
					steps.push({ step: "repo-indexed", status: "ok", detail: "Repository is indexed" });
				} else {
					steps.push({
						step: "repo-indexed",
						status: "error",
						detail: "Repository not indexed — call index_project to index",
					});
				}
			}

			// 5. Check Graphiti health
			if (steps.every((s) => s.step !== "falkordb-container" || s.status !== "error")) {
				try {
					const health = execSync("curl -sf http://localhost:8100/health", {
						encoding: "utf-8",
						timeout: 5000,
						stdio: ["ignore", "pipe", "pipe"],
					}).trim();
					if (health.includes("healthy")) {
						steps.push({
							step: "graphiti-health",
							status: "ok",
							detail: "Graphiti MCP server healthy",
						});
					} else {
						steps.push({
							step: "graphiti-health",
							status: "error",
							detail: "Graphiti responded but not healthy",
						});
					}
				} catch {
					steps.push({
						step: "graphiti-health",
						status: "error",
						detail:
							"Graphiti MCP server not reachable on localhost:8100 — may still be starting (takes ~90s)",
					});
				}
			}

			const hasErrors = steps.some((s) => s.status === "error");
			const hasFixed = steps.some((s) => s.status === "fixed");

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								healthy: !hasErrors,
								autoRepaired: hasFixed,
								host,
								steps,
							},
							null,
							2,
						),
					},
				],
				isError: hasErrors,
			};
		},
	);
}
