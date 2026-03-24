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
			FALKORDB_HOST: "falkordb.orb.local",
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

	// Merge hook config into .claude/settings.json
	const claudeSettingsPath = join(projectRoot, ".claude/settings.json");
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

		if (hooksUpdated) {
			writeFileSync(claudeSettingsPath, `${JSON.stringify(existing, null, "\t")}\n`);
			console.info("  update: .claude/settings.json (added hook config)");
		} else {
			console.info("  skip: .claude/settings.json hooks (already configured)");
		}
	} else {
		const settings = { hooks: hookConfig };
		writeFileSync(claudeSettingsPath, `${JSON.stringify(settings, null, "\t")}\n`);
		console.info("  create: .claude/settings.json (with hook config)");
	}

	// 8. Create .cgcignore (always overwrite — package-owned)
	createCgcIgnore(projectRoot);

	// 9. Run on_init hooks from enabled extensions
	console.info("\n[Extension Hooks]");
	const { getEnabledExtensions } = await import("../../lib/extension-loader.js");
	const enabledExts = getEnabledExtensions(projectRoot);
	for (const ext of enabledExts) {
		if (ext.manifest.hooks?.on_init) {
			console.info(`  ${ext.manifest.name}: running on_init...`);
			const result = run(ext.manifest.hooks.on_init);
			if (result) {
				console.info(`  ${ext.manifest.name}: ${result.slice(0, 100)}`);
			}
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

	// 11. Suggest extensions
	console.info("\n[Extensions]");
	const { extensionsSuggest } = await import("./extensions.js");
	await extensionsSuggest(projectRoot);

	// Summary
	console.info("\nDone!");
	console.info("\n⚠  Restart Claude Code to load the updated MCP server and skills.");
	console.info("\nNext steps:");
	console.info("  1. Restart Claude Code");
	console.info("  2. Edit CLAUDE.md with your project details");
	console.info("  3. Enable extensions: extensions enable falkordb cgc typescript");
	console.info("  4. Start planning: /plan your-first-feature");
}
