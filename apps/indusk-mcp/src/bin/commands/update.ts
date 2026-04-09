import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import { loadExtension } from "../../lib/extension-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");
const pkgJsonPath = join(packageRoot, "package.json");

function fileHash(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 12);
}

function run(cmd: string, opts?: { timeout?: number }): string {
	try {
		return execSync(cmd, {
			encoding: "utf-8",
			timeout: opts?.timeout ?? 30000,
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch (err: unknown) {
		const execErr = err as { stderr?: string; message?: string };
		throw new Error(execErr.stderr?.trim() || execErr.message || "Command failed");
	}
}

function getLocalVersion(): string {
	return JSON.parse(readFileSync(pkgJsonPath, "utf-8")).version;
}

export async function update(projectRoot: string): Promise<void> {
	// 1. Self-update: check npm for newer version and install it
	console.info("[indusk-mcp]\n");
	const currentVersion = getLocalVersion();
	let didUpgrade = false;

	try {
		const latestVersion = run("npm view @infinitedusky/indusk-mcp version");
		if (latestVersion !== currentVersion) {
			console.info(`  update available: ${currentVersion} → ${latestVersion}`);

			const hasGlobal = run("which indusk").length > 0;
			if (hasGlobal) {
				console.info("  updating global install...");
				try {
					run(`npm i -g @infinitedusky/indusk-mcp@${latestVersion}`, { timeout: 60000 });
					console.info(`  global: updated to ${latestVersion}`);
					didUpgrade = true;
				} catch (err) {
					console.error(`  global: FAILED — ${err instanceof Error ? err.message : err}`);
					console.error("  run manually: npm i -g @infinitedusky/indusk-mcp@latest");
				}
			}

			// Clear npx cache
			try {
				run("rm -rf ~/.npm/_npx/*");
				console.info("  npx cache: cleared");
			} catch {
				// ignore
			}
		} else {
			console.info(`  current: v${currentVersion}`);
		}
	} catch {
		console.info(`  could not check npm registry — continuing with v${currentVersion}`);
	}

	// If we upgraded, re-run update from the new version
	if (didUpgrade) {
		console.info("\n  Re-running update from new version...\n");
		try {
			execSync("indusk update", {
				cwd: projectRoot,
				timeout: 120000,
				stdio: "inherit",
				env: { ...process.env, INDUSK_SKIP_SELF_UPDATE: "1" },
			});
		} catch {
			console.info("  re-run failed — run `indusk update` again manually");
		}
		return;
	}

	// 2. Sync skills
	console.info("\n[Skills]\n");
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
			console.info(`  added: ${skillName}`);
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

	console.info(`\n  ${added} added, ${updated} updated, ${current} current.`);

	// 3. Sync community lessons
	console.info("\n[Lessons]\n");
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

	console.info(`\n  ${lessonsAdded} added, ${lessonsUpdated} updated, ${lessonsCurrent} current.`);

	// 4. Sync domain skills (only already-installed ones)
	console.info("\n[Domain Skills]\n");
	const domainSource = join(packageRoot, "skills/domain");

	let domainUpdated = 0;
	let domainCurrent = 0;

	if (existsSync(domainSource)) {
		const domainFiles = globSync("*.md", { cwd: domainSource });

		for (const file of domainFiles) {
			const skillName = file.replace(".md", "");
			const sourceFile = join(domainSource, file);
			const targetFile = join(skillsTarget, skillName, "SKILL.md");

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
		console.info(`\n  ${domainUpdated} updated, ${domainCurrent} current.`);
	} else {
		console.info("  none installed");
	}

	// 5. Sync hooks
	console.info("\n[Hooks]\n");
	const hooksSource = join(packageRoot, "hooks");
	const hooksTarget = join(projectRoot, ".claude/hooks");

	let hooksUpdated = 0;
	let hooksCurrent = 0;

	if (existsSync(hooksSource) && existsSync(hooksTarget)) {
		const hookFiles = [
			"check-gates.js",
			"gate-reminder.js",
			"validate-impl-structure.js",
			"check-catchup.js",
		];

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

		console.info(`\n  ${hooksUpdated} updated, ${hooksCurrent} current.`);
	} else {
		console.info("  not installed (run init to install)");
	}

	// 6. Sync built-in extensions
	console.info("\n[Built-in Extensions]\n");
	const builtinDir = join(packageRoot, "extensions");
	const enabledDir = join(projectRoot, ".indusk/extensions");

	let extUpdated = 0;
	let extCurrent = 0;

	if (existsSync(builtinDir) && existsSync(enabledDir)) {
		const enabledDirs = readdirSync(enabledDir, { withFileTypes: true })
			.filter((d: { isDirectory: () => boolean }) => d.isDirectory())
			.map((d: { name: string }) => d.name);

		for (const name of enabledDirs) {
			const builtinManifest = join(builtinDir, name, "manifest.json");
			const enabledManifest = join(enabledDir, name, "manifest.json");

			// Only sync built-in extensions (skip third-party)
			if (!existsSync(builtinManifest) || !existsSync(enabledManifest)) continue;

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

			// Run update hooks if present
			const manifest = loadExtension(enabledManifest);
			const updateHook = manifest?.hooks?.on_update ?? manifest?.hooks?.on_post_update;
			if (updateHook) {
				console.info(`  ${name}: running update hook...`);
				try {
					execSync(updateHook, {
						cwd: projectRoot,
						timeout: 30000,
						stdio: ["ignore", "pipe", "pipe"],
					});
					console.info(`  ${name}: update hook completed`);
				} catch {
					console.info(`  ${name}: update hook failed`);
				}
			}

			// Phase 5.5: ensure declared MCP server is registered in .mcp.json.
			// If the manifest's top-level mcp_server.add_command is set and the server
			// is missing from .mcp.json, run the command. Idempotent — skips if present.
			// The MCP server's name in .mcp.json is the extension name (matches init's
			// `claude mcp add ... <extName> ...` convention).
			const mcpServer = manifest?.mcp_server;
			if (mcpServer?.add_command) {
				const mcpJsonPath = join(projectRoot, ".mcp.json");
				let alreadyRegistered = false;
				if (existsSync(mcpJsonPath)) {
					try {
						const mcpJson = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
						alreadyRegistered = !!mcpJson.mcpServers?.[name];
					} catch {}
				}
				if (!alreadyRegistered) {
					try {
						execSync(mcpServer.add_command, {
							cwd: projectRoot,
							stdio: "pipe",
							timeout: 10000,
						});
						console.info(`  ${name}: registered MCP server`);
					} catch {
						console.info(`  ${name}: failed to register MCP server — run manually:`);
						console.info(`    ${mcpServer.add_command}`);
					}
				}
			} else if (mcpServer?.setup_instructions) {
				console.info(`  ${name}: MCP server setup — see .claude/skills/${name}/SKILL.md`);
			}
		}

		console.info(`\n  ${extUpdated} updated, ${extCurrent} current.`);
	} else {
		console.info("  no extensions enabled");
	}

	// 7. Update third-party extensions
	console.info("\n[Third-party Extensions]\n");
	try {
		const { extensionsUpdate } = await import("./extensions.js");
		await extensionsUpdate(projectRoot);
	} catch {
		console.info("  could not check third-party extensions");
	}

	// 8. Ensure .gitignore has all required entries
	console.info("\n[Git Ignores]\n");
	const { ensureGitignore } = await import("./init.js");
	ensureGitignore(projectRoot);

	// 9. Respect local mode: re-apply overlay, refresh excludes
	const { readConfig } = await import("../../lib/config.js");
	const config = readConfig(projectRoot);
	if (config?.mode === "local") {
		console.info("\n[Local Mode]\n");
		const { applyOverlay } = await import("../../lib/settings-overlay.js");
		applyOverlay(projectRoot);
		console.info("  re-applied settings overlay");
	}

	console.info("\nDone.");
	if (didUpgrade) {
		console.info("Restart Claude Code to pick up the new MCP server.");
	}
}
