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

function ensureGitignoreMcpJson(projectRoot: string): void {
	const gitignorePath = join(projectRoot, ".gitignore");
	if (existsSync(gitignorePath)) {
		const content = readFileSync(gitignorePath, "utf-8");
		if (content.includes(".mcp.json")) return;
		writeFileSync(gitignorePath, `${content.trimEnd()}\n\n# MCP config (contains auth tokens)\n.mcp.json\n`);
		console.info("  updated: .gitignore (added .mcp.json)");
	} else {
		writeFileSync(gitignorePath, "# MCP config (contains auth tokens)\n.mcp.json\n");
		console.info("  created: .gitignore (with .mcp.json)");
	}
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
	noIndex?: boolean;
}

export async function init(projectRoot: string, options: InitOptions = {}): Promise<void> {
	const { force = false, noIndex = false } = options;
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

	// 2. Copy community lessons
	console.info("\n[Lessons]");
	const lessonsSource = join(packageRoot, "lessons/community");
	const lessonsTarget = join(projectRoot, ".claude/lessons");
	mkdirSync(lessonsTarget, { recursive: true });

	if (existsSync(lessonsSource)) {
		const lessonFiles = globSync("community-*.md", { cwd: lessonsSource });
		for (const file of lessonFiles) {
			const targetFile = join(lessonsTarget, file);
			if (existsSync(targetFile) && !force) {
				console.info(`  skip: .claude/lessons/${file} (already exists)`);
				continue;
			}
			cpSync(join(lessonsSource, file), targetFile);
			console.info(`  ${existsSync(targetFile) ? "overwrite" : "create"}: .claude/lessons/${file}`);
		}
	}

	// 3. Create CLAUDE.md (never overwrite — write CLAUDE-NEW.md if exists)
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

	// 4. Set up MCP servers via claude mcp add
	console.info("\n[MCP config]");

	// Check which servers already exist
	const mcpJsonPath = join(projectRoot, ".mcp.json");
	let existingServers: Set<string> = new Set();
	if (existsSync(mcpJsonPath)) {
		try {
			const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
			existingServers = new Set(Object.keys(existing.mcpServers || {}));
		} catch {}
	}

	// Add indusk MCP server (no secrets)
	if (!existingServers.has("indusk") || force) {
		try {
			execSync(
				`claude mcp add -t stdio -s project -e PROJECT_ROOT=. -- indusk npx @infinitedusky/indusk-mcp serve`,
				{ cwd: projectRoot, stdio: "pipe", timeout: 10000 },
			);
			console.info("  added: indusk MCP server (via claude mcp add)");
		} catch {
			console.info("  failed: could not add indusk MCP server — run manually:");
			console.info('    claude mcp add -t stdio -s project -e PROJECT_ROOT=. -- indusk npx @infinitedusky/indusk-mcp serve');
		}
	} else {
		console.info("  skip: indusk MCP server (already exists)");
	}

	// Add codegraphcontext MCP server (no secrets)
	if (!existingServers.has("codegraphcontext") || force) {
		try {
			execSync(
				`claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=falkordb.orb.local -e FALKORDB_GRAPH_NAME=${projectName} -- codegraphcontext cgc mcp start`,
				{ cwd: projectRoot, stdio: "pipe", timeout: 10000 },
			);
			console.info(`  added: codegraphcontext MCP server (graph: ${projectName})`);
		} catch {
			console.info("  failed: could not add codegraphcontext MCP server — run manually:");
			console.info(`    claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=falkordb.orb.local -e FALKORDB_GRAPH_NAME=${projectName} -- codegraphcontext cgc mcp start`);
		}
	} else {
		console.info("  skip: codegraphcontext MCP server (already exists)");
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

	// 7. Install gate enforcement hooks
	console.info("\n[Hooks]");
	const hooksSource = join(packageRoot, "hooks");
	const hooksTarget = join(projectRoot, ".claude/hooks");
	const hookFiles = [
		"check-gates.js",
		"gate-reminder.js",
		"validate-impl-structure.js",
		"check-catchup.js",
	];

	if (existsSync(hooksSource)) {
		mkdirSync(hooksTarget, { recursive: true });
		for (const file of hookFiles) {
			const sourceFile = join(hooksSource, file);
			const targetFile = join(hooksTarget, file);
			if (!existsSync(sourceFile)) continue;
			if (existsSync(targetFile) && !force) {
				console.info(`  skip: .claude/hooks/${file} (already exists)`);
			} else {
				cpSync(sourceFile, targetFile);
				console.info(`  ${existsSync(targetFile) ? "overwrite" : "create"}: .claude/hooks/${file}`);
			}
		}
	}

	// Merge hook config + permissions into .claude/settings.json
	const claudeSettingsPath = join(projectRoot, ".claude/settings.json");
	const catchupPermissions = [
		"mcp__indusk__list_lessons",
		"mcp__indusk__check_health",
		"mcp__indusk__get_context",
		"mcp__indusk__list_plans",
		"mcp__indusk__extensions_status",
		"mcp__indusk__graph_ensure",
		"mcp__indusk__graph_stats",
		"mcp__indusk__get_system_version",
		"mcp__indusk__get_skill_versions",
		"mcp__indusk__index_project",
		"mcp__indusk__graph_doctor",
		"mcp__codegraphcontext__get_repository_stats",
		"mcp__codegraphcontext__list_indexed_repositories",
		"Read(.claude/handoff.md)",
		"Edit(.claude/handoff.md)",
	];
	const hookConfig = {
		PreToolUse: [
			{
				matcher: "Edit|Write",
				hooks: [
					{ type: "command", command: "node .claude/hooks/check-gates.js" },
					{ type: "command", command: "node .claude/hooks/validate-impl-structure.js" },
					{ type: "command", command: "node .claude/hooks/check-catchup.js" },
				],
			},
		],
		PostToolUse: [
			{
				matcher: "Edit|Write",
				hooks: [{ type: "command", command: "node .claude/hooks/gate-reminder.js" }],
			},
		],
	};

	if (existsSync(claudeSettingsPath)) {
		const existing = JSON.parse(readFileSync(claudeSettingsPath, "utf-8"));
		existing.hooks = existing.hooks || {};
		existing.permissions = existing.permissions || {};
		existing.permissions.allow = existing.permissions.allow || [];

		// Merge catchup permissions (add missing ones)
		const existingAllow = new Set(existing.permissions.allow as string[]);
		let permissionsUpdated = false;
		for (const perm of catchupPermissions) {
			if (!existingAllow.has(perm)) {
				existing.permissions.allow.push(perm);
				permissionsUpdated = true;
			}
		}

		let hooksUpdated = false;
		for (const [event, entries] of Object.entries(hookConfig)) {
			const existingEntries = existing.hooks[event] || [];
			// Check if our hook is already present
			const hasOurHook = existingEntries.some((e: { hooks?: { command?: string }[] }) =>
				e.hooks?.some(
					(h: { command?: string }) =>
						h.command?.includes("check-gates") ||
						h.command?.includes("gate-reminder") ||
						h.command?.includes("validate-impl") ||
						h.command?.includes("check-catchup"),
				),
			);
			if (!hasOurHook || force) {
				// Remove old entries if force, then add
				if (force) {
					existing.hooks[event] = existingEntries.filter(
						(e: { hooks?: { command?: string }[] }) =>
							!e.hooks?.some(
								(h: { command?: string }) =>
									h.command?.includes("check-gates") ||
									h.command?.includes("gate-reminder") ||
									h.command?.includes("validate-impl"),
							),
					);
				}
				existing.hooks[event] = [...(existing.hooks[event] || []), ...entries];
				hooksUpdated = true;
			}
		}

		if (hooksUpdated || permissionsUpdated) {
			writeFileSync(claudeSettingsPath, `${JSON.stringify(existing, null, "\t")}\n`);
			if (hooksUpdated) console.info("  update: .claude/settings.json (added hook config)");
			if (permissionsUpdated) console.info("  update: .claude/settings.json (added catchup permissions)");
		} else {
			console.info("  skip: .claude/settings.json (already configured)");
		}
	} else {
		const settings = { permissions: { allow: catchupPermissions }, hooks: hookConfig };
		writeFileSync(claudeSettingsPath, `${JSON.stringify(settings, null, "\t")}\n`);
		console.info("  create: .claude/settings.json (with hook config + catchup permissions)");
	}

	// 8. Create .cgcignore (always overwrite — package-owned)
	createCgcIgnore(projectRoot);
	ensureGitignoreMcpJson(projectRoot);

	// 9. Run on_init hooks from enabled extensions
	console.info("\n[Extension Hooks]");
	const { getEnabledExtensions } = await import("../../lib/extension-loader.js");
	const enabledExts = getEnabledExtensions(projectRoot);
	const builtinExtDir = join(packageRoot, "extensions");
	for (const ext of enabledExts) {
		// Re-copy extension skill if force mode
		const builtinSkill = join(builtinExtDir, ext.manifest.name, "skill.md");
		const targetSkill = join(projectRoot, ".claude/skills", ext.manifest.name, "SKILL.md");
		if (existsSync(builtinSkill)) {
			if (force || !existsSync(targetSkill)) {
				mkdirSync(join(projectRoot, ".claude/skills", ext.manifest.name), { recursive: true });
				cpSync(builtinSkill, targetSkill);
				console.info(`  ${ext.manifest.name}: skill updated`);
			}
		}
		if (ext.manifest.hooks?.on_init) {
			console.info(`  ${ext.manifest.name}: running on_init...`);
			const result = run(ext.manifest.hooks.on_init);
			if (result) {
				console.info(`  ${ext.manifest.name}: ${result.slice(0, 100)}`);
			}
		}
		// Print setup instructions for extensions with mcp_server
		if (ext.manifest.mcp_server?.setup_instructions) {
			console.info(`\n  ${ext.manifest.name}: MCP server setup needed — see .claude/skills/${ext.manifest.name}/SKILL.md for instructions`);
		}
	}
	if (enabledExts.length === 0) {
		console.info("  no extensions enabled — run 'extensions enable' to add tool integrations");
	}

	// 10. Auto-index the codebase into the graph (if CGC extension is enabled)
	const cgcEnabled = enabledExts.some((e) => e.manifest.name === "cgc");
	if (noIndex) {
		console.info("\n[Code Graph]");
		console.info("  skipped (--no-index)");
	} else if (cgcEnabled) {
		console.info("\n[Code Graph]");
		console.info("  indexing: scanning codebase...");
		try {
			const { indexProject } = await import("../../tools/graph-tools.js");
			const result = indexProject(projectRoot);
			if (result.success) {
				console.info(`  done: ${result.output}`);
			} else {
				console.info(`  error: ${result.output}`);
			}
		} catch {
			console.info("  skipped (CGC not available)");
		}
	}

	// 11. Auto-enable detected extensions
	console.info("\n[Extensions]");
	const { autoEnableExtensions } = await import("./extensions.js");
	await autoEnableExtensions(projectRoot);

	// Summary
	console.info("\nDone!");
	console.info("\n⚠  Restart Claude Code to load the updated MCP server and skills.");
	console.info("\nNext steps:");
	console.info("  1. Restart Claude Code");
	console.info("  2. Edit CLAUDE.md with your project details");
	console.info("  3. Start planning: /plan your-first-feature");
}
