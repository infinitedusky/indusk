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

/** Paths that should be gitignored in ALL modes (full + local). */
const GITIGNORE_ENTRIES = [
	{ comment: "# MCP config (contains auth tokens)", pattern: ".mcp.json" },
	{ comment: "# Session-specific handoff (not project knowledge)", pattern: ".claude/handoff.md" },
	{ comment: "# Semantic graph event log (large, local-only)", pattern: ".indusk/graph/" },
	{ comment: "# Eval results (local-only)", pattern: ".indusk/eval/" },
	{
		comment: "# Extension manifests are package-owned; env files contain secrets",
		pattern: ".indusk/extensions/",
	},
];

const GITIGNORE_MARKER = "# InDusk managed";

export function ensureGitignore(projectRoot: string): void {
	const gitignorePath = join(projectRoot, ".gitignore");
	const content = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";

	// Collect entries that are missing from the current .gitignore
	const missing = GITIGNORE_ENTRIES.filter((e) => !content.includes(e.pattern));
	if (missing.length === 0) {
		console.info("  skip: .gitignore (all InDusk entries present)");
		return;
	}

	// Build the block to append
	const block = ["", GITIGNORE_MARKER, ...missing.flatMap((e) => [e.comment, e.pattern]), ""].join(
		"\n",
	);

	writeFileSync(gitignorePath, `${content.trimEnd()}${block}`);
	const verb = content.length > 0 ? "updated" : "created";
	console.info(`  ${verb}: .gitignore (added ${missing.map((e) => e.pattern).join(", ")})`);
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
			".jj/",
			".indusk/",
			".claude/",
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
	local?: boolean;
	noIndex?: boolean;
}

interface DetectedTooling {
	linter?: string;
	testRunner?: string;
	otel?: boolean;
	typeCheck?: boolean;
}

function detectTooling(projectRoot: string): DetectedTooling {
	const detected: DetectedTooling = {};

	// Detect linter
	if (existsSync(join(projectRoot, "biome.json")) || existsSync(join(projectRoot, "biome.jsonc"))) {
		detected.linter = "biome";
	} else if (
		existsSync(join(projectRoot, ".eslintrc.js")) ||
		existsSync(join(projectRoot, ".eslintrc.json")) ||
		existsSync(join(projectRoot, ".eslintrc.cjs")) ||
		existsSync(join(projectRoot, "eslint.config.js")) ||
		existsSync(join(projectRoot, "eslint.config.mjs")) ||
		existsSync(join(projectRoot, "eslint.config.ts"))
	) {
		detected.linter = "eslint";
	}

	// Detect test runner
	if (
		existsSync(join(projectRoot, "vitest.config.ts")) ||
		existsSync(join(projectRoot, "vitest.config.js"))
	) {
		detected.testRunner = "vitest";
	} else if (
		existsSync(join(projectRoot, "jest.config.js")) ||
		existsSync(join(projectRoot, "jest.config.ts"))
	) {
		detected.testRunner = "jest";
	}

	// Detect OTel
	if (
		existsSync(join(projectRoot, "instrumentation.ts")) ||
		existsSync(join(projectRoot, "src/instrumentation.ts")) ||
		existsSync(join(projectRoot, "instrumentation.py"))
	) {
		detected.otel = true;
	}

	// Detect TypeScript
	if (existsSync(join(projectRoot, "tsconfig.json"))) {
		detected.typeCheck = true;
	}

	return detected;
}

function writeGitInfoExclude(projectRoot: string): void {
	const excludePath = join(projectRoot, ".git/info/exclude");
	const marker = "# InDusk local mode";

	// Ensure .git/info/ exists
	mkdirSync(join(projectRoot, ".git/info"), { recursive: true });

	let content = "";
	if (existsSync(excludePath)) {
		content = readFileSync(excludePath, "utf-8");
		if (content.includes(marker)) return; // Already configured
	}

	const entries = [
		"",
		marker,
		".indusk/",
		".claude/skills/",
		".claude/hooks/",
		".claude/lessons/",
		".claude/settings.json",
		".claude/handoff.md",
		".cgcignore",
		".mcp.json",
		"",
	].join("\n");

	writeFileSync(excludePath, content.trimEnd() + entries);
	console.info("  updated: .git/info/exclude (InDusk local mode entries)");
}

export async function init(projectRoot: string, options: InitOptions = {}): Promise<void> {
	const { force = false, local = false, noIndex = false } = options;
	const projectName = basename(projectRoot);
	const modeLabel = local ? " (--local)" : "";
	console.info(`Initializing InDusk dev system...${force ? " (--force)" : ""}${modeLabel}\n`);

	// Detect existing tooling
	const detected = detectTooling(projectRoot);
	if (local) {
		console.info("[Detection]");
		console.info(`  linter: ${detected.linter ?? "none"}`);
		console.info(`  test runner: ${detected.testRunner ?? "none"}`);
		console.info(`  otel: ${detected.otel ? "yes" : "no"}`);
		console.info(`  typescript: ${detected.typeCheck ? "yes" : "no"}`);
	}

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
	if (!local) {
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
	}

	// 3. Create planning directory
	const planningDir = join(projectRoot, ".indusk/planning");
	const legacyPlanningDir = join(projectRoot, "planning");
	if (existsSync(planningDir)) {
		console.info("  skip: .indusk/planning/ (already exists)");
	} else if (existsSync(legacyPlanningDir)) {
		console.info(
			"  migrate: planning/ → .indusk/planning/ (move manually or run: mv planning .indusk/planning)",
		);
	} else {
		mkdirSync(planningDir, { recursive: true });
		console.info("  create: .indusk/planning/");
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

	// Ensure CGC config is correct: localhost, cgc-{project} graph name
	if (existingServers.has("codegraphcontext") && !force) {
		try {
			const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
			const cgcEnv = mcpConfig.mcpServers?.codegraphcontext?.env;
			const correctGraph = `cgc-${projectName}`;
			if (
				cgcEnv &&
				(cgcEnv.FALKORDB_HOST !== "localhost" || cgcEnv.FALKORDB_GRAPH_NAME !== correctGraph)
			) {
				execSync("claude mcp remove -s project codegraphcontext", {
					cwd: projectRoot,
					stdio: "pipe",
					timeout: 10000,
				});
				execSync(
					`claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=localhost -e FALKORDB_GRAPH_NAME=${correctGraph} -- codegraphcontext cgc mcp start`,
					{ cwd: projectRoot, stdio: "pipe", timeout: 10000 },
				);
				console.info(`  fixed: codegraphcontext → localhost, ${correctGraph}`);
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

	// Add graphiti MCP server (Phase 5.5 — Streamable HTTP, runs in indusk-infra container)
	const graphitiAddCommand = "claude mcp add -t http -s project graphiti http://localhost:8100/mcp";
	if (!existingServers.has("graphiti") || force) {
		try {
			execSync(graphitiAddCommand, { cwd: projectRoot, stdio: "pipe", timeout: 10000 });
			console.info("  added: graphiti MCP server (http://localhost:8100/mcp)");
		} catch {
			console.info("  failed: could not add graphiti MCP server — run manually:");
			console.info(`    ${graphitiAddCommand}`);
		}
	} else {
		console.info("  skip: graphiti MCP server (already exists)");
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
	if (!local) {
		console.info("\n[Editor]");
		const vscodePath = join(projectRoot, ".vscode/settings.json");
		if (existsSync(vscodePath) && !force) {
			console.info("  skip: .vscode/settings.json (already exists)");
		} else {
			mkdirSync(join(projectRoot, ".vscode"), { recursive: true });
			cpSync(join(packageRoot, "templates/vscode-settings.json"), vscodePath);
			console.info(`  ${existsSync(vscodePath) ? "overwrite" : "create"}: .vscode/settings.json`);
		}
	}

	// 6. Create biome.json (root in full mode, .indusk/ in local mode)
	if (!local) {
		const biomePath = join(projectRoot, "biome.json");
		if (existsSync(biomePath) && !force) {
			console.info("  skip: biome.json (already exists)");
		} else {
			cpSync(join(packageRoot, "templates/biome.template.json"), biomePath);
			console.info(`  ${existsSync(biomePath) ? "overwrite" : "create"}: biome.json`);
		}
	} else {
		console.info("\n[Local Quality Tools]");
		// Biome in .indusk/
		const localBiomePath = join(projectRoot, ".indusk/biome.json");
		if (existsSync(localBiomePath) && !force) {
			console.info("  skip: .indusk/biome.json (already exists)");
		} else {
			cpSync(join(packageRoot, "templates/biome.template.json"), localBiomePath);
			console.info("  create: .indusk/biome.json");
		}

		// Test runner config in .indusk/
		if (detected.testRunner === "jest") {
			const jestConfig = join(projectRoot, ".indusk/jest.config.js");
			if (!existsSync(jestConfig) || force) {
				writeFileSync(
					jestConfig,
					[
						"/** @type {import('jest').Config} */",
						"module.exports = {",
						"  roots: ['<rootDir>/../', '<rootDir>/tests/'],",
						"  testMatch: ['<rootDir>/tests/**/*.test.{js,ts}'],",
						"};",
						"",
					].join("\n"),
				);
				console.info("  create: .indusk/jest.config.js (extends team roots)");
			}
		} else {
			// Default to vitest
			const vitestConfig = join(projectRoot, ".indusk/vitest.config.ts");
			if (!existsSync(vitestConfig) || force) {
				writeFileSync(
					vitestConfig,
					[
						'import { defineConfig } from "vitest/config";',
						"",
						"export default defineConfig({",
						"  test: {",
						'    include: [".indusk/tests/**/*.test.{ts,js}"],',
						"    passWithNoTests: true,",
						"  },",
						"});",
						"",
					].join("\n"),
				);
				console.info("  create: .indusk/vitest.config.ts");
			}
		}

		// Tests directory
		const testsDir = join(projectRoot, ".indusk/tests");
		if (!existsSync(testsDir)) {
			mkdirSync(testsDir, { recursive: true });
			writeFileSync(join(testsDir, ".gitkeep"), "");
			console.info("  create: .indusk/tests/");
		}

		// Docs directory
		const docsDir = join(projectRoot, ".indusk/docs");
		if (!existsSync(docsDir)) {
			mkdirSync(docsDir, { recursive: true });
			writeFileSync(
				join(docsDir, "index.md"),
				`# ${projectName}\n\nLocal documentation. Portable to VitePress later.\n`,
			);
			console.info("  create: .indusk/docs/ (with index.md)");
		}
	}

	// 7. Scaffold OpenTelemetry instrumentation (skip in local mode)
	const isInduskMcp = existsSync(join(projectRoot, "templates/instrumentation.ts"));
	if (local) {
		console.info("\n[OpenTelemetry]");
		console.info("  skip: local mode (team owns OTel setup)");
	} else if (isInduskMcp) {
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
	const { writeOverlay, applyOverlay } = await import("../../lib/settings-overlay.js");
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
			{
				matcher: "Bash",
				hooks: [{ type: "command", command: "node .claude/hooks/eval-trigger.js" }],
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
			// Check each hook entry individually so new hooks get added even if old ones exist
			for (const entry of entries as Array<{
				matcher: string;
				hooks: Array<{ command: string; type: string }>;
			}>) {
				const alreadyPresent = existingEntries.some(
					(e: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
						e.matcher === entry.matcher &&
						entry.hooks.every((newHook) => e.hooks?.some((h) => h.command === newHook.command)),
				);
				if (!alreadyPresent || force) {
					if (force) {
						existing.hooks[event] = (existing.hooks[event] || []).filter(
							(e: { matcher?: string }) => e.matcher !== entry.matcher,
						);
					}
					existing.hooks[event] = [...(existing.hooks[event] || []), entry];
					hooksUpdated = true;
				}
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

	// In local mode, save overlay so we can strip our additions before PRs
	if (local) {
		const overlayData = {
			permissions: { allow: catchupPermissions },
			hooks: hookConfig,
		};
		writeOverlay(projectRoot, overlayData);
		applyOverlay(projectRoot);
		console.info("  saved: .indusk/settings-overlay.json");
	}

	// 8. Create .cgcignore and manage git excludes
	createCgcIgnore(projectRoot);
	// .mcp.json contains auth tokens — always gitignore it regardless of mode
	ensureGitignore(projectRoot);
	if (local) {
		console.info("\n[Git Excludes]");
		writeGitInfoExclude(projectRoot);
	}

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

	// 12. Write .indusk/config.json
	const { writeConfig } = await import("../../lib/config.js");
	const linterTool = local ? "biome" : (detected.linter ?? "biome");
	const linterConfig = local ? ".indusk/biome.json" : "biome.json";
	const testTool = detected.testRunner ?? "vitest";
	const testConfig = local
		? `.indusk/${testTool === "jest" ? "jest.config.js" : "vitest.config.ts"}`
		: `${testTool}.config.${testTool === "jest" ? "js" : "ts"}`;
	const config = {
		mode: local ? ("local" as const) : ("full" as const),
		verify: {
			linter: { tool: linterTool, config: linterConfig },
			testRunner: { tool: testTool, config: testConfig },
			...(detected.typeCheck ? { typeCheck: "tsc" } : {}),
		},
		detected: {
			...(detected.linter ? { linter: detected.linter } : {}),
			...(detected.testRunner ? { testRunner: detected.testRunner } : {}),
			...(detected.otel ? { otel: true } : {}),
		},
	};
	writeConfig(projectRoot, config);
	console.info(`\n[Config]`);
	console.info(`  create: .indusk/config.json (mode: ${config.mode})`);

	// Create initial handoff so /catchup runs full orientation on first session
	const handoffPath = join(projectRoot, ".claude/handoff.md");
	if (!existsSync(handoffPath) || force) {
		const today = new Date().toISOString().split("T")[0];
		const handoffContent = [
			"# Handoff",
			"",
			`**Date:** ${today}`,
			"**Session:** Fresh init — first session orientation needed",
			"",
			"## Catchup Status",
			"- [ ] mcp-ready",
			"- [ ] handoff",
			"- [ ] lessons",
			"- [ ] health",
			"- [ ] context",
			"- [ ] plans",
			"- [ ] skills",
			"- [ ] extensions",
			"- [ ] graph",
			"",
			"## What Was Being Worked On",
			"`indusk init` just set up this project. No prior session.",
			"",
			"## Where It Stopped",
			"Init complete. Agent needs full orientation (lessons, context, skills, extensions, graph).",
			"",
			"## What's Next",
			"1. Run `/catchup` to orient the agent (reads lessons, context, skills, extensions, graph)",
			"2. Edit CLAUDE.md with project details",
			"3. Start planning: `/planner your-first-feature`",
			"",
			"## Open Issues",
			"None — fresh project.",
			"",
		].join("\n");
		writeFileSync(handoffPath, handoffContent);
		console.info("\n[Handoff]");
		console.info("  create: .claude/handoff.md (first-session orientation)");
	}

	// 13. Register this project in ~/.indusk/projects.json so the admin-ui
	// daemon can find it. `addProject` is idempotent on the path (returns the
	// existing entry without touching lastSeenAt) and suffix-aware on name
	// collisions.
	const { addProject } = await import("../../lib/admin/registry.js");
	const entry = addProject(projectRoot);
	console.info("\n[Project registry]");
	if (entry.name !== projectName) {
		console.info(
			`  registered: ${entry.name} (basename '${projectName}' collided with existing entry; suffixed)`,
		);
	} else {
		console.info(`  registered: ${entry.name}`);
	}

	// Summary
	console.info("\nDone!");
	console.info("\n⚠  Restart Claude Code to load the updated MCP server and skills.");
	console.info("\nNext steps:");
	console.info("  1. Set up infrastructure (if not done): indusk infra start");
	console.info("  2. Restart Claude Code — /catchup will auto-orient the agent");
	console.info("  3. Edit CLAUDE.md with your project details");
	console.info("  4. Start planning: /planner your-first-feature");
}
