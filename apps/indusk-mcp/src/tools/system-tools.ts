import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getEnabledExtensions } from "../lib/extension-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../..");

function fileHash(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
}

interface SkillStatus {
	name: string;
	installed: boolean;
	current: boolean;
	packageHash: string | null;
	installedHash: string | null;
}

export function registerSystemTools(server: McpServer, projectRoot: string): void {
	server.registerTool(
		"get_system_version",
		{
			description: "Return the installed indusk-mcp package version",
		},
		async () => {
			const pkgPath = join(packageRoot, "package.json");
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ name: pkg.name, version: pkg.version }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"check_health",
		{
			description:
				"Check health of all enabled extensions. Runs health check commands from extension manifests. Errors indicate degraded system.",
		},
		async () => {
			const checks: { name: string; status: "ok" | "error"; detail: string }[] = [];
			const extensions = getEnabledExtensions(projectRoot);

			for (const ext of extensions) {
				const healthChecks = ext.manifest.provides.health_checks ?? [];
				for (const check of healthChecks) {
					try {
						const output = execSync(check.command, {
							encoding: "utf-8",
							timeout: 10000,
							stdio: ["ignore", "pipe", "pipe"],
							cwd: projectRoot,
						}).trim();
						checks.push({
							name: `${ext.manifest.name}/${check.name}`,
							status: "ok",
							detail: output || "ok",
						});
					} catch (err: unknown) {
						const execErr = err as { stderr?: string; message?: string };
						checks.push({
							name: `${ext.manifest.name}/${check.name}`,
							status: "error",
							detail: execErr.stderr?.trim() || execErr.message || "check failed",
						});
					}
				}
			}

			if (checks.length === 0) {
				checks.push({
					name: "extensions",
					status: "ok",
					detail:
						"No extensions with health checks enabled. Run 'extensions enable falkordb cgc' to add checks.",
				});
			}

			const healthy = checks.every((c) => c.status === "ok");

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ healthy, extensions: extensions.length, checks }, null, 2),
					},
				],
				isError: !healthy,
			};
		},
	);

	server.registerTool(
		"get_skill_versions",
		{
			description:
				"Compare installed skills in .claude/skills/ to package skills. Returns status per skill: installed, current, or outdated.",
		},
		async () => {
			const skillsSource = join(packageRoot, "skills");
			const skillsTarget = join(projectRoot, ".claude/skills");

			if (!existsSync(skillsSource)) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ error: "Package skills directory not found" }, null, 2),
						},
					],
				};
			}

			const packageSkills = readdirSync(skillsSource).filter((f) => f.endsWith(".md"));
			const skills: SkillStatus[] = packageSkills.map((file) => {
				const skillName = file.replace(".md", "");
				const sourceFile = join(skillsSource, file);
				const targetFile = join(skillsTarget, skillName, "SKILL.md");

				const packageHash = fileHash(sourceFile);
				const installed = existsSync(targetFile);
				const installedHash = installed ? fileHash(targetFile) : null;

				return {
					name: skillName,
					installed,
					current: installed && packageHash === installedHash,
					packageHash,
					installedHash,
				};
			});

			const summary = {
				total: skills.length,
				installed: skills.filter((s) => s.installed).length,
				current: skills.filter((s) => s.current).length,
				outdated: skills.filter((s) => s.installed && !s.current).length,
				missing: skills.filter((s) => !s.installed).length,
			};

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ summary, skills }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"get_skill_summaries",
		{
			description:
				"Returns name, description, and type for every installed skill. Use during catchup to learn what skills are available without loading full content.",
		},
		async () => {
			const skillsTarget = join(projectRoot, ".claude/skills");
			if (!existsSync(skillsTarget)) {
				return {
					content: [{ type: "text" as const, text: JSON.stringify({ skills: [], total: 0 }) }],
				};
			}

			const skillDirs = readdirSync(skillsTarget).filter(
				(d) => !d.startsWith(".") && existsSync(join(skillsTarget, d, "SKILL.md")),
			);

			const skills = skillDirs.map((dir) => {
				const content = readFileSync(join(skillsTarget, dir, "SKILL.md"), "utf-8");

				// Try frontmatter first (process skills)
				const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
				if (fmMatch) {
					const fm = fmMatch[1];
					const name =
						fm.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? dir;
					const description =
						fm.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? "";
					const type = fm.match(/^argument-hint:/m) ? "process" : "domain";
					return { name, description, type, slash: `/${name}` };
				}

				// Fall back to heading + first paragraph (extension skills)
				const firstPara = content
					.split("\n\n")
					.find((p) => p && !p.startsWith("#") && !p.startsWith("---"));
				const description = firstPara?.replace(/\n/g, " ").slice(0, 120) ?? "";
				return { name: dir, description, type: "extension", slash: null };
			});

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ total: skills.length, skills }, null, 2),
					},
				],
			};
		},
	);

	server.registerTool(
		"extensions_status",
		{
			description:
				"List all extensions (enabled and disabled) with their capabilities. Replaces list_domain_skills.",
		},
		async () => {
			const { loadExtensions } = await import("../lib/extension-loader.js");
			const all = loadExtensions(projectRoot);

			const extensions = all.map((ext) => ({
				name: ext.manifest.name,
				description: ext.manifest.description,
				enabled: ext.enabled,
				provides: Object.keys(ext.manifest.provides),
				hasSkill: ext.manifest.provides.skill === true,
				detect: ext.manifest.detect ?? null,
			}));

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								total: extensions.length,
								enabled: extensions.filter((e) => e.enabled).length,
								disabled: extensions.filter((e) => !e.enabled).length,
								extensions,
							},
							null,
							2,
						),
					},
				],
			};
		},
	);
}
