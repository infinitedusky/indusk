import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface BiomeDiagnostic {
	file: string;
	line: number;
	column: number;
	rule: string;
	message: string;
	severity: string;
}

function parseBiomeOutput(output: string): BiomeDiagnostic[] {
	const diagnostics: BiomeDiagnostic[] = [];

	// Biome outputs diagnostics in a format like:
	// file.ts:line:col lint/category/ruleName  LEVEL  ━━━
	//   message text
	const diagRegex = /^(.+?):(\d+):(\d+)\s+([\w/]+)\s+(?:FIXABLE\s+)?/gm;
	let match = diagRegex.exec(output);
	while (match) {
		diagnostics.push({
			file: match[1],
			line: Number.parseInt(match[2], 10),
			column: Number.parseInt(match[3], 10),
			rule: match[4],
			message: "",
			severity: "error",
		});
		match = diagRegex.exec(output);
	}

	// Also catch the info-level diagnostics
	const infoRegex = /^(.+?):(\d+):(\d+)\s+([\w/]+)\s+FIXABLE/gm;
	for (
		let infoMatch = infoRegex.exec(output);
		infoMatch !== null;
		infoMatch = infoRegex.exec(output)
	) {
		const file = infoMatch[1];
		const line = Number.parseInt(infoMatch[2], 10);
		const rule = infoMatch[4];
		const existing = diagnostics.find((d) => d.file === file && d.line === line && d.rule === rule);
		if (existing) {
			existing.severity = "info";
		}
	}

	return diagnostics;
}

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
				"Run `biome check` and return structured results with file, line, rule, and severity",
		},
		async () => {
			let output: string;
			let exitCode: number;

			try {
				output = execSync("npx biome check", {
					cwd: projectRoot,
					encoding: "utf-8",
					timeout: 30000,
				});
				exitCode = 0;
			} catch (err: unknown) {
				const execErr = err as { stdout?: string; stderr?: string; status?: number };
				output = (execErr.stdout ?? "") + (execErr.stderr ?? "");
				exitCode = execErr.status ?? 1;
			}

			const diagnostics = parseBiomeOutput(output);
			const passed = exitCode === 0;

			// Extract the summary line
			const summaryMatch = output.match(/Checked \d+ files?.*/);
			const summary = summaryMatch ? summaryMatch[0] : "";

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ passed, exitCode, summary, diagnostics }, null, 2),
					},
				],
			};
		},
	);
}
