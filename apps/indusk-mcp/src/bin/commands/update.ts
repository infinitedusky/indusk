import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import { loadExtension } from "../../lib/extension-loader.js";
import { envIsFunctional } from "./extensions.js";

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

	// Short-circuit when recursively invoked from a just-completed self-update,
	// or when tests need deterministic offline behavior. Also lets preview
	// users pin to a specific version without the self-update dance on every
	// `indusk update` call.
	const skipSelfUpdate = process.env.INDUSK_SKIP_SELF_UPDATE === "1";
	if (skipSelfUpdate) {
		console.info(`  current: v${currentVersion} (self-update skipped)`);
	}
	try {
		if (skipSelfUpdate) throw new Error("skip");
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
	console.info(`  source: ${hooksSource}`);

	let hooksUpdated = 0;
	let hooksCurrent = 0;

	if (!existsSync(hooksSource)) {
		console.info(`  source missing — the package install is broken`);
	} else if (!existsSync(hooksTarget)) {
		// Never initialized — create the dir and copy all bundled hooks
		mkdirSync(hooksTarget, { recursive: true });
		console.info(`  created: ${hooksTarget}`);
		const bundled = globSync("*.js", { cwd: hooksSource });
		for (const file of bundled) {
			cpSync(join(hooksSource, file), join(hooksTarget, file));
			console.info(`  added: ${file}`);
			hooksUpdated++;
		}
		console.info(`\n  ${hooksUpdated} added.`);
	} else {
		// Both dirs exist — sync by hash compare. Discover bundled hooks from
		// the source dir rather than hardcoding names, so new hooks added to
		// the package get synced on update without code changes here.
		const hookFiles = globSync("*.js", { cwd: hooksSource });

		for (const file of hookFiles) {
			const sourceFile = join(hooksSource, file);
			const targetFile = join(hooksTarget, file);

			if (!existsSync(targetFile)) {
				cpSync(sourceFile, targetFile);
				console.info(`  added: ${file}`);
				hooksUpdated++;
				continue;
			}

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

		// Ensure eval hook is registered in settings.json
		const settingsPath = join(projectRoot, ".claude/settings.json");
		if (existsSync(settingsPath)) {
			try {
				const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
				const postHooks = settings.hooks?.PostToolUse ?? [];
				const hasBashEvalHook = postHooks.some(
					(entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
						entry.matcher === "Bash" &&
						entry.hooks?.some((h: { command?: string }) => h.command?.includes("eval-trigger")),
				);
				if (!hasBashEvalHook) {
					if (!settings.hooks) settings.hooks = {};
					if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
					settings.hooks.PostToolUse.push({
						matcher: "Bash",
						hooks: [{ type: "command", command: "node .claude/hooks/eval-trigger.js" }],
					});
					const { writeFileSync } = await import("node:fs");
					writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
					console.info("  registered eval-trigger hook in settings.json");
				}
			} catch {
				console.info("  could not register eval hook in settings.json");
			}
		}
	}

	// 5b. Migrate stale MCP configs
	const mcpJsonPath = join(projectRoot, ".mcp.json");
	if (existsSync(mcpJsonPath)) {
		try {
			const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
			let mcpChanged = false;

			// Ensure CGC config is correct: localhost, cgc-{project} graph name
			const cgcEnv = mcpConfig.mcpServers?.codegraphcontext?.env;
			if (cgcEnv) {
				const { basename } = await import("node:path");
				const projectName = basename(projectRoot);
				const correctHost = "localhost";
				const correctGraph = `cgc-${projectName}`;
				const needsFix =
					cgcEnv.FALKORDB_HOST !== correctHost || cgcEnv.FALKORDB_GRAPH_NAME !== correctGraph;
				if (needsFix) {
					try {
						run("claude mcp remove -s project codegraphcontext");
						run(
							`claude mcp add -t stdio -s project -e DATABASE_TYPE=falkordb-remote -e FALKORDB_HOST=${correctHost} -e FALKORDB_GRAPH_NAME=${correctGraph} -- codegraphcontext cgc mcp start`,
						);
						console.info(`  fixed: codegraphcontext → ${correctHost}, ${correctGraph}`);
						mcpChanged = true;
					} catch {
						console.info("  could not fix codegraphcontext — update .mcp.json manually");
					}
				}
			}

			// Migrate indusk: npx without --yes → npx --yes
			const induskArgs = mcpConfig.mcpServers?.indusk?.args;
			if (
				induskArgs &&
				Array.isArray(induskArgs) &&
				induskArgs[0] === "@infinitedusky/indusk-mcp" &&
				!induskArgs.includes("--yes")
			) {
				try {
					run("claude mcp remove -s project indusk");
					run(
						"claude mcp add -t stdio -s project -e PROJECT_ROOT=. -- indusk npx --yes @infinitedusky/indusk-mcp serve",
					);
					console.info("  migrated: indusk MCP → npx --yes");
					mcpChanged = true;
				} catch {
					console.info("  could not migrate indusk MCP — update .mcp.json manually");
				}
			}

			if (!mcpChanged) {
				console.info("  MCP config: current");
			}
		} catch {
			// ignore parse errors
		}
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

			// Sync `.env.example` reference template. Extensions that ship a
			// template (e.g., dash0 for auth credentials, local-telemetry for
			// port documentation) publish the file as a reference; whether
			// the user should then copy it to `.env` depends on whether the
			// extension functionally consumes `.env`. Always overwrite the
			// target — `.env.example` is a reference file, never user-edited;
			// the real `.env` next to it is untouched by this sync.
			const builtinExample = join(builtinDir, name, ".env.example");
			const targetExample = join(enabledDir, name, ".env.example");
			if (existsSync(builtinExample)) {
				const exists = existsSync(targetExample);
				if (!exists) {
					cpSync(builtinExample, targetExample);
					console.info(`  added: ${name} .env.example`);
				} else {
					const exampleSourceH = fileHash(builtinExample);
					const exampleTargetH = fileHash(targetExample);
					if (exampleSourceH !== exampleTargetH) {
						cpSync(builtinExample, targetExample);
						console.info(`  updated: ${name} .env.example`);
					}
				}
				// Nudge only when `.env` is functionally required (auth-
				// headered MCP server) AND not yet present. Reference-only
				// templates (local-telemetry's port docs) stay silent.
				const targetEnv = join(enabledDir, name, ".env");
				if (!existsSync(targetEnv) && envIsFunctional(name)) {
					console.info(`  ${name}: .env not found — copy the template to activate:`);
					console.info(
						`    cp .indusk/extensions/${name}/.env.example .indusk/extensions/${name}/.env`,
					);
				}
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

	// 7b. Required-by-default migration. For projects authored before a
	// given required extension existed (e.g., pre-1.28 `local-telemetry`),
	// `autoEnableExtensions` notices it's marked `required: true` in the
	// shipped built-ins, not enabled here, and not in `disabled_extensions`
	// — then enables it + fires on_enable so the downstream wiring
	// (daemon registration, `.mcp.json` mutation, etc.) runs. Idempotent
	// on subsequent runs: already-enabled required extensions are skipped.
	console.info("\n[Required Extensions]\n");
	const { autoEnableExtensions } = await import("./extensions.js");
	await autoEnableExtensions(projectRoot);

	// 8. Ensure ignores: in full mode, refresh tracked .gitignore. In local
	// mode, leave .gitignore untouched and refresh .git/info/exclude (per-clone,
	// never committed) so InDusk patterns ignore correctly without a PR diff.
	const { readConfig } = await import("../../lib/config.js");
	const config = readConfig(projectRoot);
	const isLocal = config?.mode === "local";
	console.info("\n[Git Ignores]\n");
	if (isLocal) {
		const { writeGitInfoExclude } = await import("./init.js");
		writeGitInfoExclude(projectRoot);
	} else {
		const { ensureGitignore } = await import("./init.js");
		ensureGitignore(projectRoot);
	}

	// 9. Respect local mode: re-apply overlay
	if (isLocal) {
		console.info("\n[Local Mode]\n");
		const { applyOverlay } = await import("../../lib/settings-overlay.js");
		applyOverlay(projectRoot);
		console.info("  re-applied settings overlay");
	}

	// 10. Maintain the admin-ui project registry. If the cwd's basename is
	// already registered and the path matches, bump `lastSeenAt`. Otherwise
	// call `addProject` — either the project was never registered (pre-1.27
	// projects being updated to the new shape) or the path changed and we
	// want a fresh entry. `validateProject` throws when the name is absent;
	// `addProject` is idempotent on path match.
	console.info("\n[Project registry]\n");
	const { basename } = await import("node:path");
	const { addProject, touchProject, validateProject } = await import(
		"../../lib/admin/registry.js"
	);
	const projectName = basename(projectRoot);
	try {
		const { entry, pathExists } = validateProject(projectName);
		if (entry.path === projectRoot && pathExists) {
			touchProject(projectName);
			console.info(`  touched: ${projectName} (lastSeenAt updated)`);
		} else {
			const added = addProject(projectRoot);
			console.info(`  registered: ${added.name} (entry for '${projectName}' had a different path)`);
		}
	} catch {
		const added = addProject(projectRoot);
		if (added.name !== projectName) {
			console.info(`  registered: ${added.name} (basename '${projectName}' collided; suffixed)`);
		} else {
			console.info(`  registered: ${added.name}`);
		}
	}

	console.info("\nDone.");
	if (didUpgrade) {
		console.info("Restart Claude Code to pick up the new MCP server.");
	}
}
