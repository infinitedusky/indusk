import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync } from "node:fs";
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
	let skipped = 0;

	for (const file of skillFiles) {
		const skillName = file.replace(".md", "");
		const sourceFile = join(skillsSource, file);
		const targetFile = join(skillsTarget, skillName, "SKILL.md");

		if (!existsSync(targetFile)) {
			console.info(`  skip: ${skillName} (not installed — run init first)`);
			skipped++;
			continue;
		}

		const sourceHash = fileHash(sourceFile);
		const targetHash = fileHash(targetFile);

		if (sourceHash === targetHash) {
			console.info(`  current: ${skillName}`);
			skipped++;
		} else {
			cpSync(sourceFile, targetFile);
			console.info(`  updated: ${skillName}`);
			updated++;
		}
	}

	console.info(`\n${updated} updated, ${skipped} current.`);
}
