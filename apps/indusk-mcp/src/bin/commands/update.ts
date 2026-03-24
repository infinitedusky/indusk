import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import { loadExtension } from "../../lib/extension-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");

function fileHash(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
}

export async function update(projectRoot: string): Promise<void> {
	console.info("Checking for skill updates...\n");

	const skillsSource = join(packageRoot, "skills");
	const skillsTarget = join(projectRoot, ".claude/skills");
	const skillFiles = globSync("*.md", { cwd: skillsSource });

	let updated = 0;
	let added = 0;
	let current = 0;

	for (const file of skillFiles) {
		const skillName = file.replace(".md", "");
		const sourceFile = join(skillsSource, file);
		const targetDir = join(skillsTarget, skillName);
		const targetFile = join(targetDir, "SKILL.md");

		if (!existsSync(targetFile)) {
			mkdirSync(targetDir, { recursive: true });
			cpSync(sourceFile, targetFile);
			console.info(`  added: ${skillName} (new skill)`);
			added++;
			continue;
		}

		const sourceHash = fileHash(sourceFile);
		const targetHash = fileHash(targetFile);

		if (sourceHash === targetHash) {
			console.info(`  current: ${skillName}`);
			current++;
		} else {
			cpSync(sourceFile, targetFile);
			console.info(`  updated: ${skillName}`);
			updated++;
		}
	}

	console.info(`\n${added} added, ${updated} updated, ${current} current.`);

	// Sync community lessons (only community- prefixed files)
	console.info("\nChecking for lesson updates...\n");
	const lessonsSource = join(packageRoot, "lessons/community");
	const lessonsTarget = join(projectRoot, ".claude/lessons");

	let lessonsAdded = 0;
	let lessonsUpdated = 0;
	let lessonsCurrent = 0;

	if (existsSync(lessonsSource)) {
		mkdirSync(lessonsTarget, { recursive: true });
		const lessonFiles = globSync("community-*.md", { cwd: lessonsSource });

		for (const file of lessonFiles) {
			const sourceFile = join(lessonsSource, file);
			const targetFile = join(lessonsTarget, file);

			if (!existsSync(targetFile)) {
				cpSync(sourceFile, targetFile);
				console.info(`  added: ${file}`);
				lessonsAdded++;
				continue;
			}

			const sourceH = fileHash(sourceFile);
			const targetH = fileHash(targetFile);

			if (sourceH === targetH) {
				console.info(`  current: ${file}`);
				lessonsCurrent++;
			} else {
				cpSync(sourceFile, targetFile);
				console.info(`  updated: ${file}`);
				lessonsUpdated++;
			}
		}
	}

	console.info(`\n${lessonsAdded} added, ${lessonsUpdated} updated, ${lessonsCurrent} current.`);

	// Sync installed domain skills (only update ones already installed)
	console.info("\nChecking for domain skill updates...\n");
	const domainSource = join(packageRoot, "skills/domain");

	let domainUpdated = 0;
	let domainCurrent = 0;

	if (existsSync(domainSource)) {
		const domainFiles = globSync("*.md", { cwd: domainSource });

		for (const file of domainFiles) {
			const skillName = file.replace(".md", "");
			const sourceFile = join(domainSource, file);
			const targetFile = join(skillsTarget, skillName, "SKILL.md");

			// Only update if already installed — don't install new domain skills during update
			if (!existsSync(targetFile)) continue;

			const sourceH = fileHash(sourceFile);
			const targetH = fileHash(targetFile);

			if (sourceH === targetH) {
				console.info(`  current: ${skillName}`);
				domainCurrent++;
			} else {
				cpSync(sourceFile, targetFile);
				console.info(`  updated: ${skillName}`);
				domainUpdated++;
			}
		}
	}

	if (domainUpdated + domainCurrent > 0) {
		console.info(`\n${domainUpdated} updated, ${domainCurrent} current.`);
	} else {
		console.info("  no domain skills installed");
	}

	// Sync hook scripts (only if hooks directory exists in target)
	console.info("\nChecking for hook updates...\n");
	const hooksSource = join(packageRoot, "hooks");
	const hooksTarget = join(projectRoot, ".claude/hooks");

	let hooksUpdated = 0;
	let hooksCurrent = 0;

	if (existsSync(hooksSource) && existsSync(hooksTarget)) {
		const hookFiles = ["check-gates.js", "gate-reminder.js", "validate-impl-structure.js"];

		for (const file of hookFiles) {
			const sourceFile = join(hooksSource, file);
			const targetFile = join(hooksTarget, file);

			if (!existsSync(sourceFile) || !existsSync(targetFile)) continue;

			const sourceH = fileHash(sourceFile);
			const targetH = fileHash(targetFile);

			if (sourceH === targetH) {
				console.info(`  current: ${file}`);
				hooksCurrent++;
			} else {
				cpSync(sourceFile, targetFile);
				console.info(`  updated: ${file}`);
				hooksUpdated++;
			}
		}

		console.info(`\n${hooksUpdated} updated, ${hooksCurrent} current.`);
	} else {
		console.info("  hooks not installed (run init to install)");
	}

	// Sync enabled built-in extensions (manifests, skills, print mcp_server config)
	console.info("\nChecking for extension updates...\n");
	const builtinDir = join(packageRoot, "extensions");
	const enabledDir = join(projectRoot, ".indusk/extensions");

	let extUpdated = 0;
	let extCurrent = 0;

	if (existsSync(builtinDir) && existsSync(enabledDir)) {
		const enabledFiles = readdirSync(enabledDir).filter(
			(f: string) => f.endsWith(".json") && !f.startsWith("."),
		);

		for (const file of enabledFiles) {
			const name = file.replace(".json", "");
			const builtinManifest = join(builtinDir, name, "manifest.json");
			const enabledManifest = join(enabledDir, file);

			// Only sync built-in extensions (skip third-party)
			if (!existsSync(builtinManifest)) continue;

			const sourceH = fileHash(builtinManifest);
			const targetH = fileHash(enabledManifest);

			if (sourceH !== targetH) {
				cpSync(builtinManifest, enabledManifest);
				console.info(`  updated: ${name} manifest`);
				extUpdated++;
			} else {
				console.info(`  current: ${name}`);
				extCurrent++;
			}

			// Sync extension skill
			const builtinSkill = join(builtinDir, name, "skill.md");
			const targetSkill = join(skillsTarget, name, "SKILL.md");
			if (existsSync(builtinSkill) && existsSync(targetSkill)) {
				const skillSourceH = fileHash(builtinSkill);
				const skillTargetH = fileHash(targetSkill);
				if (skillSourceH !== skillTargetH) {
					cpSync(builtinSkill, targetSkill);
					console.info(`  updated: ${name} skill`);
				}
			} else if (existsSync(builtinSkill) && !existsSync(targetSkill)) {
				mkdirSync(join(skillsTarget, name), { recursive: true });
				cpSync(builtinSkill, targetSkill);
				console.info(`  added: ${name} skill`);
			}

			// Print setup reference for extensions with mcp_server
			const manifest = loadExtension(enabledManifest);
			if (manifest?.mcp_server?.setup_instructions) {
				console.info(`  ${name}: MCP server setup — see .claude/skills/${name}/SKILL.md`);
			}
		}

		console.info(`\n${extUpdated} updated, ${extCurrent} current.`);
	} else {
		console.info("  no extensions enabled");
	}
}
