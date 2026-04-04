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
		writeFileSync(
			gitignorePath,
			`${content.trimEnd()}\n\n# MCP config (contains auth tokens)\n.mcp.json\n`,
		);
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

	// Add indusk MCP server — prefer global binary, fall back to npx
	const hasGlobalIndusk = run("which indusk") || run("where indusk");
	const induskCommand = hasGlobalIndusk
		? "claude mcp add -t stdio -s project -e PROJECT_ROOT=. -- indusk indusk serve"
		: "claude mcp add -t stdio -s project -e PROJECT_ROOT=. -- indusk npx --yes @infinitedusky/indusk-mcp serve";

	if (!existingServers.has("indusk") || force) {
		try {
			execSync(induskCommand, { cwd: projectRoot, stdio: "pipe", timeout: 10000 });
			console.info(`  added: indusk MCP server (${hasGlobalIndusk ? "global binary" : "via npx"})`);
		} catch {
			console.info("  failed: could not add indusk MCP server — run manually:");
			console.info(`    ${induskCommand}`);
		}
	} else {
		// Migrate from npx to global binary if available
		if (hasGlobalIndusk) {
			try {
				const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
				const induskArgs = mcpConfig.mcpServers?.indusk?.args;
				if (induskArgs?.includes("npx")) {
					execSync(induskCommand, { cwd: projectRoot, stdio: "pipe", timeout: 10000 });
					console.info("  migrated: indusk MCP server (npx → global binary)");
				} else {
					console.info("  skip: indusk MCP server (already exists)");
				}
			} catch {
				console.info("  skip: indusk MCP server (already exists)");
			}
		} else {
			console.info("  skip: indusk MCP server (already exists)");
		}
	}

	// Install CGC if not present
	const cgcInstalled = run("cgc --version");
	if (cgcInstalled) {
		console.info(`  skip: codegraphcontext (${cgcInstalled})`);
	} else {
		const hasPipx = run("pipx --version");
		if (hasPipx) {
			console.info("  installing: codegraphcontext via pipx...");
			try {
				execSync("pipx install codegraphcontext", {
					timeout: 60000,
					stdio: ["ignore", "pipe", "pipe"],
				});
				console.info("  installed: codegraphcontext");
			} catch {
				console.info("  failed: could not install codegraphcontext — run manually:");
				console.info("    pipx install codegraphcontext");
			}
		} else {
			console.info(
				"  skip: codegraphcontext (pipx not found — install pipx first, then: pipx install codegraphcontext)",
			);
		}
	}

	// Migrate CGC config: falkordb.orb.local → localhost (indusk-infra container)
	if (existingServers.has("codegraphcontext") && !force) {
		try {
			const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
			const cgcEnv = mcpConfig.mcpServers?.codegraphcontext?.env;
			if (cgcEnv?.FALKORDB_HOST === "falkordb.orb.local") {
				execSync(
					`claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=localhost -e FALKORDB_GRAPH_NAME=${cgcEnv.FALKORDB_GRAPH_NAME || `cgc-${projectName}`} -- codegraphcontext cgc mcp start`,
					{ cwd: projectRoot, stdio: "pipe", timeout: 10000 },
				);
				console.info("  migrated: codegraphcontext FALKORDB_HOST → localhost (indusk-infra)");
			}
		} catch {}
	}

	// Add codegraphcontext MCP server (no secrets)
	if (!existingServers.has("codegraphcontext") || force) {
		try {
			execSync(
				`claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=localhost -e FALKORDB_GRAPH_NAME=cgc-${projectName} -- codegraphcontext cgc mcp start`,
				{ cwd: projectRoot, stdio: "pipe", timeout: 10000 },
			);
			console.info(`  added: codegraphcontext MCP server (graph: cgc-${projectName})`);
		} catch {
			console.info("  failed: could not add codegraphcontext MCP server — run manually:");
			console.info(
				`    claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=localhost -e FALKORDB_GRAPH_NAME=cgc-${projectName} -- codegraphcontext cgc mcp start`,
			);
		}
	} else {
		console.info("  skip: codegraphcontext MCP server (already exists)");
	}

	// 4b. Check infrastructure container
	console.info("\n[Infrastructure]");
	try {
		const infraStatus = execSync("docker inspect --format='{{.State.Running}}' indusk-infra", {
			encoding: "utf-8",
			timeout: 5000,
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		if (infraStatus === "true") {
			console.info("  ok: indusk-infra container is running");
		} else {
			console.info("  starting: indusk-infra container...");
			execSync("docker start indusk-infra", {
				timeout: 15000,
				stdio: ["ignore", "pipe", "pipe"],
			});
			console.info("  started: indusk-infra");
		}
	} catch {
		console.info("  skip: indusk-infra container not found");
		console.info("    To set up infrastructure: indusk infra start");
	}

	// 4c. Copy Graphiti extension manifest
	const graphitiExtDir = join(projectRoot, ".indusk/extensions/graphiti");
	const graphitiManifest = join(graphitiExtDir, "manifest.json");
	if (existsSync(graphitiManifest) && !force) {
		console.info("  skip: graphiti extension (already exists)");
	} else {
		mkdirSync(graphitiExtDir, { recursive: true });
		cpSync(join(packageRoot, "extensions/graphiti/manifest.json"), graphitiManifest);
		const skillSource = join(packageRoot, "extensions/graphiti/skill.md");
		if (existsSync(skillSource)) {
			cpSync(skillSource, join(graphitiExtDir, "skill.md"));
		}
		console.info("  create: .indusk/extensions/graphiti/ (manifest + skill)");
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

	// 7. Scaffold OpenTelemetry instrumentation
	// Skip if this is the indusk-mcp package itself (has templates/ directory with instrumentation.ts)
	const isInduskMcp = existsSync(join(projectRoot, "templates/instrumentation.ts"));
	if (isInduskMcp) {
		console.info("\n[OpenTelemetry]");
		console.info("  skip: this is the indusk-mcp package (templates are source, not scaffolded)");
	} else {
		console.info("\n[OpenTelemetry]");
		const otelTemplates = ["instrumentation.ts", "filtering-exporter.ts", "logger.ts"];
		const isNextJs =
			existsSync(join(projectRoot, "next.config.js")) ||
			existsSync(join(projectRoot, "next.config.ts")) ||
			existsSync(join(projectRoot, "next.config.mjs"));
		const isPython =
			existsSync(join(projectRoot, "requirements.txt")) ||
			existsSync(join(projectRoot, "pyproject.toml"));
		const isReactSPA =
			!isNextJs &&
			(existsSync(join(projectRoot, "vite.config.ts")) ||
				existsSync(join(projectRoot, "vite.config.js")));

		if (isPython) {
			const pyTemplate = "instrumentation.py";
			const targetFile = join(projectRoot, pyTemplate);
			if (existsSync(targetFile) && !force) {
				console.info(`  skip: ${pyTemplate} (already exists)`);
			} else {
				cpSync(join(packageRoot, "templates", pyTemplate), targetFile);
				console.info(`  create: ${pyTemplate}`);
				console.info(
					"  install: pip install opentelemetry-distro opentelemetry-instrumentation opentelemetry-exporter-otlp",
				);
				console.info("  run: opentelemetry-instrument python your_app.py");
			}
		} else if (isNextJs) {
			// Next.js — use @vercel/otel
			const instrTarget = join(projectRoot, "instrumentation.ts");
			if (existsSync(instrTarget) && !force) {
				console.info("  skip: instrumentation.ts (already exists)");
			} else {
				cpSync(join(packageRoot, "templates/instrumentation.next.ts"), instrTarget);
				const content = readFileSync(instrTarget, "utf-8");
				writeFileSync(instrTarget, content.replace('"unknown-service"', `"${projectName}"`));
				console.info("  create: instrumentation.ts (Next.js — @vercel/otel)");
			}

			// Logger
			const loggerTarget = join(projectRoot, "src/logger.ts");
			if (existsSync(loggerTarget) && !force) {
				console.info("  skip: src/logger.ts (already exists)");
			} else {
				const loggerDir = join(projectRoot, "src");
				mkdirSync(loggerDir, { recursive: true });
				cpSync(join(packageRoot, "templates/logger.ts"), loggerTarget);
				console.info("  create: src/logger.ts");
			}

			// Client-side browser instrumentation
			const webInstrTarget = join(projectRoot, "src/instrumentation.web.ts");
			if (existsSync(webInstrTarget) && !force) {
				console.info("  skip: src/instrumentation.web.ts (already exists)");
			} else {
				const srcDir = join(projectRoot, "src");
				mkdirSync(srcDir, { recursive: true });
				cpSync(join(packageRoot, "templates/instrumentation.web.ts"), webInstrTarget);
				const content = readFileSync(webInstrTarget, "utf-8");
				writeFileSync(webInstrTarget, content.replace('"unknown-service"', `"${projectName}"`));
				console.info("  create: src/instrumentation.web.ts (browser — OTel Web SDK)");
			}

			console.info(
				"  install: pnpm add @vercel/otel pino pino-opentelemetry-transport @opentelemetry/sdk-trace-web @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/instrumentation @opentelemetry/instrumentation-fetch @opentelemetry/instrumentation-document-load @opentelemetry/instrumentation-user-interaction",
			);
			console.info("  wire (server): Next.js loads instrumentation.ts automatically");
			console.info(
				"  wire (client): import './instrumentation.web' in your root client component or layout",
			);
		} else if (isReactSPA) {
			// React SPA (Vite) — browser instrumentation via Dash0 Web SDK
			const srcDir = existsSync(join(projectRoot, "src")) ? join(projectRoot, "src") : projectRoot;
			const instrTarget = join(srcDir, "instrumentation.ts");
			if (existsSync(instrTarget) && !force) {
				console.info("  skip: instrumentation.ts (already exists)");
			} else {
				cpSync(join(packageRoot, "templates/instrumentation.web.ts"), instrTarget);
				const content = readFileSync(instrTarget, "utf-8");
				writeFileSync(instrTarget, content.replace('"unknown-service"', `"${projectName}"`));
				console.info("  create: src/instrumentation.ts (React SPA — @dash0/sdk-web)");
			}

			console.info(
				"  install: pnpm add @opentelemetry/sdk-trace-web @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/instrumentation @opentelemetry/instrumentation-fetch @opentelemetry/instrumentation-document-load @opentelemetry/instrumentation-user-interaction",
			);
			console.info("  wire: import './instrumentation' at the top of your main.tsx or App.tsx");
		} else {
			// Node.js — full SDK with auto-instrumentation
			const srcDir = existsSync(join(projectRoot, "src")) ? join(projectRoot, "src") : projectRoot;

			for (const template of otelTemplates) {
				const targetFile = join(srcDir, template);
				if (existsSync(targetFile) && !force) {
					console.info(`  skip: ${template} (already exists)`);
					continue;
				}
				cpSync(join(packageRoot, "templates", template), targetFile);
				console.info(`  create: ${template}`);
			}

			// Set service name in instrumentation.ts
			const instrPath = join(srcDir, "instrumentation.ts");
			if (existsSync(instrPath)) {
				const content = readFileSync(instrPath, "utf-8");
				writeFileSync(instrPath, content.replace('"unknown-service"', `"${projectName}"`));
			}

			const packages = [
				"@opentelemetry/sdk-node",
				"@opentelemetry/auto-instrumentations-node",
				"@opentelemetry/exporter-trace-otlp-http",
				"@opentelemetry/sdk-trace-base",
				"@opentelemetry/resources",
				"@opentelemetry/semantic-conventions",
				"@opentelemetry/core",
				"pino",
				"pino-opentelemetry-transport",
			];
			console.info(`  install: pnpm add ${packages.join(" ")}`);
			console.info("  wire: node --import ./src/instrumentation.ts src/index.ts");
		}
	} // end isInduskMcp else

	// 7b. Next.js webpack config — ensure --webpack dev script and aggregateTimeout watchOptions
	if (!isInduskMcp) {
		const nextConfigs = ["next.config.ts", "next.config.js", "next.config.mjs"].map((f) =>
			join(projectRoot, f),
		);
		const nextConfigPath = nextConfigs.find((f) => existsSync(f));
		if (nextConfigPath) {
			console.info("\n[Next.js Webpack Config]");
			const configContent = readFileSync(nextConfigPath, "utf-8");
			if (!configContent.includes("aggregateTimeout")) {
				console.info(
					`  warn: ${nextConfigPath.split("/").pop()} is missing aggregateTimeout in webpack watchOptions`,
				);
				console.info("  add the following to your next.config:");
				console.info("    webpack: (config) => {");
				console.info(
					"      config.watchOptions = { ...config.watchOptions, aggregateTimeout: 600 };",
				);
				console.info("      return config;");
				console.info("    }");
			} else {
				console.info(`  ok: aggregateTimeout configured in ${nextConfigPath.split("/").pop()}`);
			}

			// Check dev script for --turbopack
			const pkgJsonPath = join(projectRoot, "package.json");
			if (existsSync(pkgJsonPath)) {
				const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
				const devScript = pkgJson.scripts?.dev || "";
				if (devScript.includes("--turbopack")) {
					console.info("  warn: dev script uses --turbopack — remove it");
					console.info(
						"  Turbopack's 1ms file watcher debounce causes crashes with external tool writes on macOS",
					);
					console.info("  Next.js <16: plain 'next dev' uses webpack by default");
					console.info("  Next.js 16+: use 'next dev --webpack' to opt out of Turbopack");
				} else {
					console.info("  ok: dev script does not use Turbopack");
				}
			}
		}
	}

	// 8. Install gate enforcement hooks
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
		"mcp__indusk__get_skill_summaries",
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
			if (permissionsUpdated)
				console.info("  update: .claude/settings.json (added catchup permissions)");
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
			console.info(
				`\n  ${ext.manifest.name}: MCP server setup needed — see .claude/skills/${ext.manifest.name}/SKILL.md for instructions`,
			);
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
	console.info("  1. Set up infrastructure (if not done): indusk infra start");
	console.info("  2. Restart Claude Code");
	console.info("  3. Edit CLAUDE.md with your project details");
	console.info("  4. Start planning: /plan your-first-feature");
}
