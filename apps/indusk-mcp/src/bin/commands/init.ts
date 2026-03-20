import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");

export async function init(projectRoot: string): Promise<void> {
	console.info("Initializing InDusk dev system...\n");

	// 1. Copy skills
	const skillsSource = join(packageRoot, "skills");
	const skillsTarget = join(projectRoot, ".claude/skills");
	const skillFiles = globSync("*.md", { cwd: skillsSource });

	for (const file of skillFiles) {
		const skillName = file.replace(".md", "");
		const targetDir = join(skillsTarget, skillName);
		const targetFile = join(targetDir, "SKILL.md");

		if (existsSync(targetFile)) {
			console.info(`  skip: .claude/skills/${skillName}/SKILL.md (already exists)`);
			continue;
		}

		mkdirSync(targetDir, { recursive: true });
		cpSync(join(skillsSource, file), targetFile);
		console.info(`  create: .claude/skills/${skillName}/SKILL.md`);
	}

	// 2. Create CLAUDE.md
	const claudeMdPath = join(projectRoot, "CLAUDE.md");
	if (existsSync(claudeMdPath)) {
		console.info("  skip: CLAUDE.md (already exists)");
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

	// 4. Add MCP server config to .mcp.json
	const mcpJsonPath = join(projectRoot, ".mcp.json");
	const mcpEntry = {
		command: "npx",
		args: ["@infinitedusky/dev-system", "serve"],
		env: { PROJECT_ROOT: "." },
	};

	if (existsSync(mcpJsonPath)) {
		const existing = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
		if (existing.mcpServers?.indusk) {
			console.info("  skip: .mcp.json indusk entry (already exists)");
		} else {
			existing.mcpServers = existing.mcpServers || {};
			existing.mcpServers.indusk = mcpEntry;
			writeFileSync(mcpJsonPath, `${JSON.stringify(existing, null, "\t")}\n`);
			console.info("  update: .mcp.json (added indusk entry)");
		}
	} else {
		const mcpJson = { mcpServers: { indusk: mcpEntry } };
		writeFileSync(mcpJsonPath, `${JSON.stringify(mcpJson, null, "\t")}\n`);
		console.info("  create: .mcp.json");
	}

	// 5. Generate .vscode/settings.json
	const vscodePath = join(projectRoot, ".vscode/settings.json");
	if (existsSync(vscodePath)) {
		console.info("  skip: .vscode/settings.json (already exists)");
	} else {
		mkdirSync(join(projectRoot, ".vscode"), { recursive: true });
		cpSync(join(packageRoot, "templates/vscode-settings.json"), vscodePath);
		console.info("  create: .vscode/settings.json");
	}

	// 6. Create base biome.json
	const biomePath = join(projectRoot, "biome.json");
	if (existsSync(biomePath)) {
		console.info("  skip: biome.json (already exists)");
	} else {
		cpSync(join(packageRoot, "templates/biome.template.json"), biomePath);
		console.info("  create: biome.json");
	}

	console.info("\nDone! Next steps:");
	console.info("  1. Edit CLAUDE.md with your project details");
	console.info("  2. Install Biome: pnpm add -D @biomejs/biome");
	console.info("  3. Start planning: /plan your-first-feature");
}
