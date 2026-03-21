import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { discoverVerificationCommands } from "../lib/verification-discovery.js";

export function registerQualityTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"get_quality_config",
		{
			description:
				"Read biome.json and biome-rationale.md, returning the quality config as structured data",
		},
		async () => {
			const biomePath = join(projectRoot, "biome.json");
			const rationalePath = join(projectRoot, "biome-rationale.md");

			const biomeConfig = existsSync(biomePath)
				? JSON.parse(readFileSync(biomePath, "utf-8"))
				: null;

			const rationale = existsSync(rationalePath) ? readFileSync(rationalePath, "utf-8") : null;

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ biomeConfig, rationale }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"suggest_rule",
		{
			description:
				"Given a mistake description, suggest Biome rules that could prevent it. Searches the installed Biome rule catalog.",
			inputSchema: {
				description: z.string().describe("Description of the mistake or pattern to prevent"),
			},
		},
		async ({ description }) => {
			// Get the list of rules from biome rage
			let rulesOutput: string;
			try {
				rulesOutput = execSync("npx biome rage --linter", {
					cwd: projectRoot,
					encoding: "utf-8",
					timeout: 15000,
				});
			} catch {
				rulesOutput = "";
			}

			// Search for keywords from the description in the rules list
			const keywords = description
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 3);

			const lines = rulesOutput.split("\n");
			const matches = lines.filter((line) => {
				const lower = line.toLowerCase();
				return keywords.some((kw) => lower.includes(kw));
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								query: description,
								keywords,
								suggestions:
									matches.length > 0
										? matches.slice(0, 20)
										: ["No matching rules found — consider a custom approach or check biome docs"],
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
		"quality_check",
		{
			description:
				"Run verification checks. With mode 'discover', returns detected commands without running. With mode 'run' (default), executes all discovered checks or a specific command if provided.",
			inputSchema: {
				mode: z
					.enum(["run", "discover"])
					.default("run")
					.describe("'discover' lists available checks, 'run' executes them"),
				command: z
					.string()
					.optional()
					.describe("Specific command to run (overrides auto-discovery). Only used in 'run' mode."),
			},
		},
		async ({ mode, command }) => {
			const discovered = discoverVerificationCommands(projectRoot);

			if (mode === "discover") {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ discovered }, null, 2),
						},
					],
				};
			}

			// Run mode
			const commands = command
				? [{ name: "custom", command, source: "explicit" as const }]
				: discovered;

			if (commands.length === 0) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({
								passed: true,
								note: "No verification commands discovered. Add scripts to package.json or provide a command explicitly.",
							}),
						},
					],
				};
			}

			const results = commands.map((cmd) => {
				let output: string;
				let exitCode: number;
				try {
					output = execSync(cmd.command, {
						cwd: projectRoot,
						encoding: "utf-8",
						timeout: 60000,
						stdio: ["ignore", "pipe", "pipe"],
					});
					exitCode = 0;
				} catch (err: unknown) {
					const execErr = err as { stdout?: string; stderr?: string; status?: number };
					output = (execErr.stdout ?? "") + (execErr.stderr ?? "");
					exitCode = execErr.status ?? 1;
				}

				return {
					name: cmd.name,
					command: cmd.command,
					source: cmd.source,
					passed: exitCode === 0,
					exitCode,
					output: output.slice(-2000),
				};
			});

			const allPassed = results.every((r) => r.passed);

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ passed: allPassed, results }, null, 2),
					},
				],
			};
		},
	);
}
