import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");

function run(cmd: string, options?: { stdio?: "ignore" | "pipe" | "inherit" }): string {
	try {
		return execSync(cmd, {
			encoding: "utf-8",
			timeout: 15000,
			stdio: options?.stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return "";
	}
}

function ensureFalkorDB(): void {
	// Check if FalkorDB container exists and is running
	const status = run('docker ps --filter name=falkordb --format "{{.Status}}"');
	if (status) {
		console.info("  ok: FalkorDB container running");
		return;
	}

	// Check if container exists but is stopped
	const stopped = run('docker ps -a --filter name=falkordb --format "{{.Status}}"');
	if (stopped) {
		console.info("  start: FalkorDB container (was stopped)");
		run("docker start falkordb");
		return;
	}

	// Create and start the container
	console.info("  create: FalkorDB container (global, persistent)");
	run(
		"docker run -d --name falkordb --restart unless-stopped -p 6379:6379 -v falkordb-global:/data falkordb/falkordb:latest",
	);
}

function checkCGC(): boolean {
	const cgcPaths = [join(process.env.HOME ?? "", ".local/bin/cgc"), "/usr/local/bin/cgc"];
	const found = cgcPaths.find((p) => existsSync(p));
	if (found) {
		console.info(`  ok: CGC found at ${found}`);
		return true;
	}
	console.info("  missing: CGC — install via: pipx install codegraphcontext");
	return false;
}

function createCgcIgnore(projectRoot: string): void {
	const ignorePath = join(projectRoot, ".cgcignore");
	if (existsSync(ignorePath)) {
		console.info("  skip: .cgcignore (already exists)");
		return;
	}
	writeFileSync(
		ignorePath,
		[
			"node_modules/",
			".next/",
			"dist/",
			"build/",
			".git/",
			"*.png",
			"*.jpg",
			"*.svg",
			"*.ico",
			"*.woff",
			"*.woff2",
			"*.lock",
			"pnpm-lock.yaml",
			"package-lock.json",
			"",
		].join("\n"),
	);
	console.info("  create: .cgcignore");
}

export interface InitOptions {
	force?: boolean;
}

export async function init(projectRoot: string, options: InitOptions = {}): Promise<void> {
	const { force = false } = options;
	const projectName = basename(projectRoot);
	console.info(`Initializing InDusk dev system...${force ? " (--force)" : ""}\n`);

	// 1. Copy skills
	console.info("[Skills]");
	const skillsSource = join(packageRoot, "skills");
	const skillsTarget = join(projectRoot, ".claude/skills");
	const skillFiles = globSync("*.md", { cwd: skillsSource });

	for (const file of skillFiles) {
		const skillName = file.replace(".md", "");
		const targetDir = join(skillsTarget, skillName);
		const targetFile = join(targetDir, "SKILL.md");

		if (existsSync(targetFile) && !force) {
			console.info(`  skip: .claude/skills/${skillName}/SKILL.md (already exists)`);
			continue;
		}

		mkdirSync(targetDir, { recursive: true });
		cpSync(join(skillsSource, file), targetFile);
		console.info(
			`  ${existsSync(targetFile) ? "overwrite" : "create"}: .claude/skills/${skillName}/SKILL.md`,
		);
	}

	// 2. Create CLAUDE.md (never overwrite — write CLAUDE-NEW.md if exists)
	console.info("\n[Project files]");
	const claudeMdPath = join(projectRoot, "CLAUDE.md");
	if (existsSync(claudeMdPath)) {
		const newPath = join(projectRoot, "CLAUDE-NEW.md");
		cpSync(join(packageRoot, "templates/CLAUDE.md"), newPath);
		console.info("  create: CLAUDE-NEW.md (merge manually with existing CLAUDE.md)");
	} else {
		cpSync(join(packageRoot, "templates/CLAUDE.md"), claudeMdPath);
		console.info("  create: CLAUDE.md");
	}

	// 3. Create planning directory
	const planningDir = join(projectRoot, "planning");
	if (existsSync(planningDir)) {
		console.info("  skip: planning/ (already exists)");
	} else {
		mkdirSync(planningDir, { recursive: true });
		console.info("  create: planning/");
	}

	// 4. Set up .mcp.json with both indusk and codegraphcontext
	console.info("\n[MCP config]");
	const mcpJsonPath = join(projectRoot, ".mcp.json");
	const induskEntry = {
		command: "npx",
		args: ["@infinitedusky/indusk-mcp", "serve"],
		env: { PROJECT_ROOT: "." },
	};

	const cgcEntry = {
		command: "cgc",
		args: ["mcp", "start"],
		env: {
			DATABASE_TYPE: "falkordb-remote",
			FALKORDB_HOST: "localhost",
			FALKORDB_PORT: "6379",
			FALKORDB_GRAPH_NAME: projectName,
		},
	};

	if (existsSync(mcpJsonPath)) {
		const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
		let updated = false;
		existing.mcpServers = existing.mcpServers || {};

		if (!existing.mcpServers.indusk || force) {
			existing.mcpServers.indusk = induskEntry;
			console.info(`  ${existing.mcpServers.indusk ? "overwrite" : "add"}: .mcp.json indusk entry`);
			updated = true;
		} else {
			console.info("  skip: .mcp.json indusk entry (already exists)");
		}

		if (!existing.mcpServers.codegraphcontext || force) {
			existing.mcpServers.codegraphcontext = cgcEntry;
			console.info(
				`  ${existing.mcpServers.codegraphcontext ? "overwrite" : "add"}: .mcp.json codegraphcontext (graph: ${projectName})`,
			);
			updated = true;
		} else {
			console.info("  skip: .mcp.json codegraphcontext entry (already exists)");
		}

		if (updated) {
			writeFileSync(mcpJsonPath, `${JSON.stringify(existing, null, "\t")}\n`);
		}
	} else {
		const mcpJson = {
			mcpServers: {
				indusk: induskEntry,
				codegraphcontext: cgcEntry,
			},
		};
		writeFileSync(mcpJsonPath, `${JSON.stringify(mcpJson, null, "\t")}\n`);
		console.info("  create: .mcp.json (indusk + codegraphcontext)");
	}

	// 5. Generate .vscode/settings.json
	console.info("\n[Editor]");
	const vscodePath = join(projectRoot, ".vscode/settings.json");
	if (existsSync(vscodePath) && !force) {
		console.info("  skip: .vscode/settings.json (already exists)");
	} else {
		mkdirSync(join(projectRoot, ".vscode"), { recursive: true });
		cpSync(join(packageRoot, "templates/vscode-settings.json"), vscodePath);
		console.info(`  ${existsSync(vscodePath) ? "overwrite" : "create"}: .vscode/settings.json`);
	}

	// 6. Create base biome.json
	const biomePath = join(projectRoot, "biome.json");
	if (existsSync(biomePath) && !force) {
		console.info("  skip: biome.json (already exists)");
	} else {
		cpSync(join(packageRoot, "templates/biome.template.json"), biomePath);
		console.info(`  ${existsSync(biomePath) ? "overwrite" : "create"}: biome.json`);
	}

	// 7. Create .cgcignore (always overwrite — package-owned)
	createCgcIgnore(projectRoot);

	// 8. Infrastructure: FalkorDB + CGC
	console.info("\n[Infrastructure]");
	const dockerAvailable = run("docker info") !== "";
	if (dockerAvailable) {
		ensureFalkorDB();
	} else {
		console.info("  missing: Docker — install Docker or OrbStack to enable FalkorDB");
	}

	const cgcInstalled = checkCGC();

	// 9. Auto-index the codebase into the graph
	if (dockerAvailable && cgcInstalled) {
		console.info("\n[Code Graph]");
		console.info("  indexing: scanning codebase...");
		const { indexProject } = await import("../../tools/graph-tools.js");
		const result = indexProject(projectRoot);
		if (result.success) {
			console.info(`  done: ${result.output}`);
		} else {
			console.info(`  error: ${result.output}`);
		}
	}

	// Summary
	console.info("\nDone!");
	if (!cgcInstalled || !dockerAvailable) {
		console.info("\nManual steps needed:");
		if (!dockerAvailable) {
			console.info("  1. Install Docker or OrbStack");
			console.info("  2. Re-run init to set up FalkorDB");
		}
		if (!cgcInstalled) {
			console.info("  - Install CGC: pipx install codegraphcontext");
		}
	}
	console.info("\nNext steps:");
	console.info("  1. Edit CLAUDE.md with your project details");
	console.info("  2. Start a Claude Code session — MCP tools will be available");
	console.info("  3. Start planning: /plan your-first-feature");
}
