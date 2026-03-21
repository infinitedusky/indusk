import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";

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
}
