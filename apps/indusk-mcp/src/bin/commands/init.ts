import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
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
	{
		comment: "# Multi-agent presence bulletin (per-session, machine-local)",
		pattern: ".indusk/agents/",
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

/**
 * Idempotently set `.indusk/current.md merge=union` in the project's
 * `.gitattributes`. The `merge=union` driver tells git to combine both
 * sides' line additions on merge instead of producing a conflict — exactly
 * what we want for per-agent sections where each session only appends its
 * own block. Without this, two branches both appending different sections
 * at the same end-of-file position produce a same-insertion-point conflict
 * even though there's no semantic overlap. See handoff-multi-agent-section-shape
 * ADR for the merge-strategy rationale.
 */
export function ensureCurrentMdMergeUnion(projectRoot: string): void {
	const path = join(projectRoot, ".gitattributes");
	const marker = ".indusk/current.md merge=union";
	const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
	if (existing.includes(marker)) {
		console.info("  skip: .gitattributes (current.md merge=union already present)");
		return;
	}
	const block = `${existing.trimEnd()}${existing.length > 0 ? "\n\n" : ""}# InDusk: combine per-agent section additions on merge\n${marker}\n`;
	writeFileSync(path, block);
	console.info(
		`  ${existing.length > 0 ? "updated" : "created"}: .gitattributes (.indusk/current.md merge=union)`,
	);
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
	/**
	 * Workbench mode (Phase 6 of indusk-worktree-extension). Initializes
	 * cwd as a flat single-repo workbench wrapping `wrappedRepo` (which
	 * must already exist at `<siblingParent>/<wrappedRepo>/`). Writes
	 * worktree.shape="workbench" + worktree.wrapped_repo + worktree.sibling_parent
	 * to .indusk/config.json and auto-enables the `worktree` extension
	 * (which scaffolds scripts/worktree/, the pnpm scripts, and the
	 * starter .indusk/worktree-configs/<repo>.json).
	 */
	workbench?: boolean;
	wrappedRepo?: string;
	siblingParent?: string;
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

// ---- Biome wiring (full mode only) -----------------------------------------
//
// `init` is opinionated: TypeScript / Node projects use Biome as the single
// lint+format tool. ESLint and Prettier are out. Detection of an existing
// ESLint config does NOT cause InDusk to "respect" the existing tool — it
// triggers a vestige warning instead.
//
// The wiring step does three things:
// 1. Add `@biomejs/biome` to the root `devDependencies` (matches the version
//    referenced in `templates/biome.template.json`'s schema URL).
// 2. Replace `lint` and `format` scripts that are SIMPLE invocations of
//    eslint / next-lint / prettier with their Biome equivalents. Conservative:
//    if the script contains `&&` / `||` / `;` (compound), leave it alone —
//    rewriting it would silently drop other steps (e.g. `&& tsc --noEmit`).
// 3. Surface a "[Lint migration warnings]" block listing residual ESLint /
//    Prettier configs and devDeps. The user finishes the migration; init
//    doesn't remove user-visible files or devDeps automatically.
//
// Dawn (v2) will replace this with a config-file-driven preference. Until
// then, opinionated.

const BIOME_VERSION_PIN = "^2.4.8";

const SIMPLE_ESLINT_RE = /^(npx\s+)?eslint\b/;
const SIMPLE_NEXT_LINT_RE = /^(npx\s+)?next\s+lint\b/;
const SIMPLE_PRETTIER_RE = /^(npx\s+)?prettier\b/;

function isCompoundScript(value: string): boolean {
	return value.includes("&&") || value.includes("||") || value.includes(";");
}

function rewriteScriptValue(name: string, value: string): string | null {
	if (isCompoundScript(value)) return null;
	if (name === "lint") {
		if (SIMPLE_ESLINT_RE.test(value) || SIMPLE_NEXT_LINT_RE.test(value)) {
			return "biome check";
		}
	}
	if (name === "format") {
		if (SIMPLE_PRETTIER_RE.test(value)) {
			return "biome format --write";
		}
	}
	return null;
}

function collectPackageJsonPaths(projectRoot: string): string[] {
	const paths: string[] = [];
	const root = join(projectRoot, "package.json");
	if (existsSync(root)) paths.push(root);
	for (const subdir of ["apps", "packages"]) {
		const base = join(projectRoot, subdir);
		if (!existsSync(base)) continue;
		for (const entry of globSync("*/package.json", { cwd: base })) {
			paths.push(join(base, entry));
		}
	}
	return paths;
}

interface PackageJson {
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
	[k: string]: unknown;
}

interface BiomeWiringResult {
	scriptsChanged: number;
	packagesChanged: number;
	devDepAdded: boolean;
	compoundScriptsSkipped: Array<{ pkgPath: string; name: string; value: string }>;
	packagePaths: string[];
}

function wireBiomeIntoProject(projectRoot: string): BiomeWiringResult {
	const result: BiomeWiringResult = {
		scriptsChanged: 0,
		packagesChanged: 0,
		devDepAdded: false,
		compoundScriptsSkipped: [],
		packagePaths: collectPackageJsonPaths(projectRoot),
	};

	const rootPath = join(projectRoot, "package.json");

	for (const pkgPath of result.packagePaths) {
		let pkg: PackageJson;
		let raw: string;
		try {
			raw = readFileSync(pkgPath, "utf-8");
			pkg = JSON.parse(raw) as PackageJson;
		} catch {
			continue;
		}
		let modified = false;

		if (pkg.scripts) {
			for (const [name, value] of Object.entries(pkg.scripts)) {
				// Flag compound scripts that LOOK like they should migrate, so the
				// user can manually decide what to keep.
				if (
					(name === "lint" || name === "format") &&
					isCompoundScript(value) &&
					(SIMPLE_ESLINT_RE.test(value) ||
						SIMPLE_NEXT_LINT_RE.test(value) ||
						SIMPLE_PRETTIER_RE.test(value))
				) {
					result.compoundScriptsSkipped.push({ pkgPath, name, value });
					continue;
				}
				const replacement = rewriteScriptValue(name, value);
				if (replacement && replacement !== value) {
					pkg.scripts[name] = replacement;
					console.info(
						`    ${pkgPath.replace(`${projectRoot}/`, "")}: ${name} = "${value}" → "${replacement}"`,
					);
					result.scriptsChanged++;
					modified = true;
				}
			}
		}

		if (pkgPath === rootPath) {
			pkg.devDependencies = pkg.devDependencies ?? {};
			if (!pkg.devDependencies["@biomejs/biome"]) {
				pkg.devDependencies["@biomejs/biome"] = BIOME_VERSION_PIN;
				console.info(`    package.json: + @biomejs/biome ${BIOME_VERSION_PIN} (devDependencies)`);
				result.devDepAdded = true;
				modified = true;
			}
		}

		if (modified) {
			// Preserve trailing newline (most editors expect it)
			const trailingNewline = raw.endsWith("\n") ? "\n" : "";
			writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}${trailingNewline || "\n"}`);
			result.packagesChanged++;
		}
	}

	return result;
}

const ESLINT_CONFIG_FILES = [
	".eslintrc.js",
	".eslintrc.json",
	".eslintrc.cjs",
	".eslintrc.yml",
	".eslintrc.yaml",
	"eslint.config.js",
	"eslint.config.mjs",
	"eslint.config.cjs",
	"eslint.config.ts",
];

const PRETTIER_CONFIG_FILES = [
	".prettierrc",
	".prettierrc.json",
	".prettierrc.js",
	".prettierrc.cjs",
	".prettierrc.yaml",
	".prettierrc.yml",
	".prettierrc.toml",
	"prettier.config.js",
	"prettier.config.cjs",
	"prettier.config.mjs",
];

function isEslintOrPrettierDep(name: string): boolean {
	return (
		name === "eslint" ||
		name === "prettier" ||
		name.startsWith("eslint-") ||
		name.startsWith("@eslint/") ||
		name.startsWith("@typescript-eslint/") ||
		name.startsWith("eslint-plugin-") ||
		name.startsWith("eslint-config-") ||
		name.startsWith("prettier-plugin-") ||
		name.startsWith("@prettier/")
	);
}

interface LintVestiges {
	configFiles: string[];
	depsByPackage: Array<{ pkgPath: string; deps: string[] }>;
}

function detectLintVestiges(projectRoot: string, packagePaths: string[]): LintVestiges {
	const configFiles: string[] = [];
	for (const cfg of [...ESLINT_CONFIG_FILES, ...PRETTIER_CONFIG_FILES]) {
		if (existsSync(join(projectRoot, cfg))) configFiles.push(cfg);
	}
	for (const pkgPath of packagePaths) {
		const dir = dirname(pkgPath);
		if (dir === projectRoot) continue; // already covered above
		for (const cfg of [...ESLINT_CONFIG_FILES, ...PRETTIER_CONFIG_FILES]) {
			if (existsSync(join(dir, cfg))) {
				configFiles.push(join(dir, cfg).replace(`${projectRoot}/`, ""));
			}
		}
	}

	const depsByPackage: Array<{ pkgPath: string; deps: string[] }> = [];
	for (const pkgPath of packagePaths) {
		let pkg: PackageJson;
		try {
			pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJson;
		} catch {
			continue;
		}
		const allDeps = { ...(pkg.devDependencies ?? {}), ...(pkg.dependencies ?? {}) };
		const offending = Object.keys(allDeps).filter(isEslintOrPrettierDep);
		if (offending.length > 0) {
			depsByPackage.push({
				pkgPath: pkgPath.replace(`${projectRoot}/`, ""),
				deps: offending,
			});
		}
	}

	return { configFiles, depsByPackage };
}

export function writeGitInfoExclude(projectRoot: string): void {
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
	const { force = false, local = false, noIndex = false, workbench = false } = options;
	const projectName = basename(projectRoot);
	const modeLabel = [local ? "--local" : "", workbench ? "--workbench" : ""]
		.filter(Boolean)
		.join(" ");
	console.info(
		`Initializing InDusk dev system...${force ? " (--force)" : ""}${modeLabel ? ` (${modeLabel})` : ""}\n`,
	);

	// Workbench mode (Phase 6 of indusk-worktree-extension): validate the
	// `--workbench --wrapped-repo --sibling-parent` flag combo + create the
	// trunk symlink. We do this BEFORE the rest of init so the on_enable
	// hook (fired at the end via extensionsEnable) sees a valid workbench.
	if (workbench) {
		const wrappedRepo = options.wrappedRepo;
		const siblingParentRaw = options.siblingParent;
		if (!wrappedRepo || !siblingParentRaw) {
			console.error(
				"Error: --workbench requires --wrapped-repo <name> AND --sibling-parent <path>",
			);
			console.error(
				"  --wrapped-repo names the single repo this workbench wraps (e.g., 'numero').",
			);
			console.error(
				"  --sibling-parent is the parent dir of the canonical clone (e.g., '~/code/sandbox').",
			);
			process.exit(1);
		}
		const siblingParent = siblingParentRaw.startsWith("~/")
			? join(homedir(), siblingParentRaw.slice(2))
			: siblingParentRaw;
		const canonicalClone = join(siblingParent, wrappedRepo);
		if (!existsSync(join(canonicalClone, ".git"))) {
			console.error(`Error: canonical clone not found at ${canonicalClone} (no .git/ there).`);
			console.error(
				`  Expected: <sibling-parent>/${wrappedRepo} where <sibling-parent>=${siblingParent}`,
			);
			process.exit(1);
		}
		const trunkLink = join(projectRoot, wrappedRepo);
		if (existsSync(trunkLink)) {
			console.info(`[Workbench] trunk symlink already exists: ${wrappedRepo}`);
		} else {
			// Use a relative target so the workbench is portable.
			const rel = relative(projectRoot, canonicalClone);
			symlinkSync(rel, trunkLink);
			console.info(`[Workbench] created trunk symlink: ${wrappedRepo} -> ${rel}`);
		}
	}

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

		// AGENTS.md — agent conduct directives, imported by CLAUDE.md via @AGENTS.md
		const agentsMdPath = join(projectRoot, "AGENTS.md");
		if (existsSync(agentsMdPath)) {
			console.info(
				"  skip: AGENTS.md (already exists — review templates/AGENTS.md for conduct directives)",
			);
		} else {
			cpSync(join(packageRoot, "templates/AGENTS.md"), agentsMdPath);
			console.info("  create: AGENTS.md");
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

	// 3.5. Create .indusk/current.md (operational state layer)
	const currentMdPath = join(projectRoot, ".indusk/current.md");
	if (existsSync(currentMdPath)) {
		console.info("  skip: .indusk/current.md (already exists)");
	} else {
		const currentTemplate = join(packageRoot, "templates/current.md");
		if (existsSync(currentTemplate)) {
			cpSync(currentTemplate, currentMdPath);
			console.info("  create: .indusk/current.md (from template)");
		}
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

		// 6.5. Wire Biome into package.json files: add devDep + replace simple
		// eslint/prettier/next-lint scripts. Then surface ESLint/Prettier
		// vestiges so the user can finish the migration.
		console.info("\n[Biome wiring]");
		const wiring = wireBiomeIntoProject(projectRoot);
		if (
			wiring.scriptsChanged === 0 &&
			!wiring.devDepAdded &&
			wiring.compoundScriptsSkipped.length === 0
		) {
			console.info("  skip: Biome already wired (no scripts to migrate, devDep present)");
		} else if (wiring.devDepAdded || wiring.scriptsChanged > 0) {
			console.info(
				`  done: ${wiring.scriptsChanged} script(s) migrated, ${wiring.packagesChanged} package.json file(s) updated`,
			);
			if (wiring.devDepAdded) {
				console.info("  → run `pnpm install` (or npm/yarn) to install @biomejs/biome");
			}
		}
		if (wiring.compoundScriptsSkipped.length > 0) {
			console.info("  ⚠ compound scripts skipped (manual migration needed):");
			for (const s of wiring.compoundScriptsSkipped) {
				console.info(`    ${s.pkgPath.replace(`${projectRoot}/`, "")}: ${s.name} = "${s.value}"`);
			}
		}

		const vestiges = detectLintVestiges(projectRoot, wiring.packagePaths);
		if (vestiges.configFiles.length > 0 || vestiges.depsByPackage.length > 0) {
			console.info("\n[Lint migration warnings]");
			console.info("  Biome is now wired, but ESLint/Prettier residue remains.");
			console.info(
				"  InDusk does not auto-remove user-visible files / devDeps; finish the cutover manually:\n",
			);
			if (vestiges.configFiles.length > 0) {
				console.info("  Config files to delete:");
				for (const f of vestiges.configFiles) console.info(`    - ${f}`);
			}
			if (vestiges.depsByPackage.length > 0) {
				console.info("  devDependencies to remove:");
				for (const p of vestiges.depsByPackage) {
					console.info(`    - ${p.pkgPath}: ${p.deps.join(", ")}`);
				}
			}
			console.info("  After cleanup, run `pnpm install` to refresh the lockfile.");
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

	// 8. Install gate enforcement + eval-trigger hooks. Discover hook files
	// from the package source via globSync rather than maintaining a hardcoded
	// list — matches the pattern in `update.ts:240` so any new hook the
	// package ships gets installed on next `init` without code changes.
	// Pre-Phase-6 (git-or-jj-substrate) the array was hardcoded and missed
	// `eval-trigger.js`; settings.json registered it but the file was never
	// copied, so the eval hook silently never fired on fresh-init projects.
	console.info("\n[Hooks]");
	const hooksSource = join(packageRoot, "hooks");
	const hooksTarget = join(projectRoot, ".claude/hooks");

	if (existsSync(hooksSource)) {
		mkdirSync(hooksTarget, { recursive: true });
		const hookFiles = globSync("*.js", { cwd: hooksSource });
		for (const file of hookFiles) {
			const sourceFile = join(hooksSource, file);
			const targetFile = join(hooksTarget, file);
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
		"mcp__indusk__get_project_info",
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
	if (local) {
		// Local mode keeps the tracked .gitignore untouched — InDusk patterns
		// go in .git/info/exclude (per-clone, never committed) instead.
		console.info("\n[Git Excludes]");
		writeGitInfoExclude(projectRoot);
	} else {
		// .mcp.json contains auth tokens — always gitignore it in full mode
		ensureGitignore(projectRoot);
		ensureCurrentMdMergeUnion(projectRoot);
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

	// composable.env deprecation nudge if the project being initialized still
	// carries a ce.json (non-destructive — just prints).
	const { ceDeprecationNotice } = await import("./update.js");
	const ceNotice = ceDeprecationNotice(projectRoot);
	if (ceNotice) console.info(ceNotice);

	// 12. Write .indusk/config.json — InDusk is opinionated: linter is always
	// Biome. ESLint/Prettier detection becomes a vestige warning (see step 6.5),
	// not a recorded preference. Dawn (v2) will move this to a config-file-driven
	// preference; until then, single-tool default.
	const { writeConfig } = await import("../../lib/config.js");
	const linterTool = "biome";
	const linterConfig = local ? ".indusk/biome.json" : "biome.json";
	const testTool = detected.testRunner ?? "vitest";
	const testConfig = local
		? `.indusk/${testTool === "jest" ? "jest.config.js" : "vitest.config.ts"}`
		: `${testTool}.config.${testTool === "jest" ? "js" : "ts"}`;
	// git is the only SCM as of 1.31.0 (git-only-substrate Phase 4) —
	// no SCM detection or scm field write needed.
	const config = {
		mode: local ? ("local" as const) : ("full" as const),
		verify: {
			linter: { tool: linterTool, config: linterConfig },
			testRunner: { tool: testTool, config: testConfig },
			...(detected.typeCheck ? { typeCheck: "tsc" } : {}),
		},
		detected: {
			...(detected.testRunner ? { testRunner: detected.testRunner } : {}),
			...(detected.otel ? { otel: true } : {}),
		},
		agents: {
			stale_ttl_minutes: 60,
		},
		...(workbench && options.wrappedRepo && options.siblingParent
			? {
					worktree: {
						shape: "workbench" as const,
						wrapped_repo: options.wrappedRepo,
						sibling_parent: options.siblingParent,
					},
				}
			: {}),
	};
	writeConfig(projectRoot, config);

	// Workbench mode: explicitly enable the worktree extension AFTER the
	// config write so the on_enable hook sees worktree.shape="workbench"
	// + worktree.wrapped_repo. The extension is required:false so
	// autoEnableExtensions doesn't pick it up.
	if (workbench) {
		console.info("\n[Workbench] enabling worktree extension");
		const { extensionsEnable } = await import("./extensions.js");
		await extensionsEnable(projectRoot, ["worktree"]);
	}
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
			"",
			"## What Was Being Worked On",
			"`indusk init` just set up this project. No prior session.",
			"",
			"## Where It Stopped",
			"Init complete. Agent needs full orientation (lessons, context, skills, extensions).",
			"",
			"## What's Next",
			"1. Run `/catchup` to orient the agent (reads lessons, context, skills, extensions)",
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
