import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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
				"Check health of dev system dependencies: FalkorDB connectivity, CGC installation, and Docker container status. Errors indicate the system is degraded.",
		},
		async () => {
			const checks: { name: string; status: "ok" | "error"; detail: string }[] = [];

			// Check FalkorDB TCP connectivity
			const falkordbHost = process.env.FALKORDB_HOST ?? "localhost";
			const falkordbPort = Number.parseInt(process.env.FALKORDB_PORT ?? "6379", 10);
			const falkordbOk = await new Promise<boolean>((resolve) => {
				const socket = createConnection({ host: falkordbHost, port: falkordbPort }, () => {
					socket.destroy();
					resolve(true);
				});
				socket.setTimeout(3000);
				socket.on("timeout", () => {
					socket.destroy();
					resolve(false);
				});
				socket.on("error", () => {
					resolve(false);
				});
			});
			checks.push({
				name: "falkordb",
				status: falkordbOk ? "ok" : "error",
				detail: falkordbOk
					? `Connected to ${falkordbHost}:${falkordbPort}`
					: `Cannot connect to FalkorDB at ${falkordbHost}:${falkordbPort} — run: docker start falkordb`,
			});

			// Check CGC installed — cgc prints version to stderr, so check binary exists
			const cgcPaths = [join(process.env.HOME ?? "", ".local/bin/cgc"), "/usr/local/bin/cgc"];
			const cgcPath = cgcPaths.find((p) => existsSync(p));
			checks.push({
				name: "codegraphcontext",
				status: cgcPath ? "ok" : "error",
				detail: cgcPath
					? `CGC found at ${cgcPath}`
					: "CGC not found — install via: pipx install codegraphcontext",
			});

			// Check FalkorDB Docker container
			let containerRunning = false;
			try {
				const ps = execSync('docker ps --filter name=falkordb --format "{{.Status}}"', {
					encoding: "utf-8",
					timeout: 5000,
					stdio: ["ignore", "pipe", "pipe"],
				}).trim();
				containerRunning = ps.length > 0;
				checks.push({
					name: "falkordb-container",
					status: containerRunning ? "ok" : "error",
					detail: containerRunning
						? `Container status: ${ps}`
						: "FalkorDB container not running — run: docker start falkordb",
				});
			} catch {
				checks.push({
					name: "falkordb-container",
					status: "error",
					detail: "Docker not available or falkordb container not found",
				});
			}

			const healthy = checks.every((c) => c.status === "ok");

			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify({ healthy, checks }, null, 2),
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
}
