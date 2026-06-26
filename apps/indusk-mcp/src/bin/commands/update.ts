import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import { loadExtension } from "../../lib/extension-loader.js";
import { checkLatestVersion, hasNewerVersion } from "../../lib/version-check.js";
import { envIsFunctional } from "./extensions.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");

/**
 * composable.env deprecation notice. Returns a non-destructive nudge toward the
 * `doppler` extension when the project still has a `ce.json`, else null. Pure
 * read — never mutates or removes the project's composable.env setup, so the
 * legacy opt-in keeps working.
 */
export function ceDeprecationNotice(projectRoot: string): string | null {
	if (!existsSync(join(projectRoot, "ce.json"))) return null;
	return [
		"\n[composable.env]",
		"  ⚠ composable.env is deprecated in favor of the `doppler` extension",
		"    (Doppler + plain docker-compose; per-worktree auto-provisioning).",
		"    Your ce.json is untouched — composable.env keeps working (opt-in).",
		"    To migrate, see numero's `composable-env-removal` plan as the worked example.",
	].join("\n");
}
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
	// CLI version is informational only here. The actual upgrade lives in
	// `indusk upgrade` — see `bin/commands/upgrade.ts` for the rationale.
	// `indusk update` is strictly project-state work (skills, hooks,
	// extensions, settings overlay, registry); it never mutates the
	// machine-state global install. A non-blocking notice at the end
	// surfaces newer versions without coupling the two.
	console.info("[indusk-mcp]\n");
	const currentVersion = getLocalVersion();
	console.info(`  current: v${currentVersion}`);

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

			// Sync jaeger MCP url to the live telemetry daemon's mcpPort.
			// `mcpPort` is OS-assigned per spawn so it rotates on every daemon
			// start/restart; without this sync, `indusk update` couldn't fix
			// a project whose entry had gone stale from a prior daemon run.
			// Only writes when the daemon is running AND the URL is wrong;
			// silent no-op otherwise.
			const jaegerEntry = mcpConfig.mcpServers?.jaeger;
			if (jaegerEntry?.type === "http" && typeof jaegerEntry.url === "string") {
				try {
					const { daemonStatus } = await import("../../lib/telemetry/daemon.js");
					const status = await daemonStatus();
					if (status.running) {
						const expectedUrl = `http://localhost:${status.mcpPort}/mcp`;
						if (jaegerEntry.url !== expectedUrl) {
							const { writeFileSync } = await import("node:fs");
							mcpConfig.mcpServers.jaeger = { type: "http", url: expectedUrl };
							writeFileSync(mcpJsonPath, `${JSON.stringify(mcpConfig, null, 2)}\n`);
							console.info(`  synced: jaeger MCP url → ${expectedUrl}`);
							mcpChanged = true;
						}
					}
				} catch {
					// Daemon not running, or write failed — don't block update.
				}
			}

			if (!mcpChanged) {
				console.info("  MCP config: current");
			}
		} catch {
			// ignore parse errors
		}
	}

	// 5b. Ensure AGENTS.md exists (agent conduct directives, imported by CLAUDE.md
	// via @AGENTS.md). Never overwrites — users may extend the file. Pre-1.28.x
	// projects pick it up on next update; new projects get it from init.
	console.info("\n[Project files]\n");
	{
		const agentsMdPath = join(projectRoot, "AGENTS.md");
		if (existsSync(agentsMdPath)) {
			console.info("  current: AGENTS.md");
		} else {
			cpSync(join(packageRoot, "templates/AGENTS.md"), agentsMdPath);
			console.info("  added: AGENTS.md");
			console.info(
				"  note: add `@AGENTS.md` to the top of CLAUDE.md to import the conduct directives",
			);
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

	// composable.env deprecation nudge (non-destructive — only prints).
	const ceNotice = ceDeprecationNotice(projectRoot);
	if (ceNotice) console.info(ceNotice);

	// 7c. SCM field migration. Pre-1.28.x projects don't have `scm` in their
	// config — detect once and write it back. Idempotent on subsequent runs:
	// if the field is already populated, do nothing.
	console.info("\n[SCM Detection]\n");
	const { readConfig, writeConfig } = await import("../../lib/config.js");
	const { detectScm } = await import("../../lib/scm/detect.js");
	const scmConfig = readConfig(projectRoot);
	if (scmConfig && !scmConfig.scm) {
		try {
			const scm = await detectScm(projectRoot);
			writeConfig(projectRoot, { ...scmConfig, scm });
			console.info(`  add: scm: "${scm}"`);
		} catch (err) {
			console.info(`  skip: ${err instanceof Error ? err.message : String(err)}`);
		}
	} else if (scmConfig?.scm) {
		console.info(`  ok: scm: "${scmConfig.scm}" (already set)`);
	}

	// 7c. Multi-agent scaffolding (handoff-multi-agent Phase 4). Idempotently
	// migrate pre-1.29 projects to the new operational-state + presence-bulletin
	// convention. Creates .indusk/current.md if missing (does NOT overwrite an
	// existing one — that file holds user state) and adds agents.stale_ttl_minutes
	// to config if absent.
	console.info("\n[Multi-Agent Scaffolding]\n");
	const { cpSync: _cpSyncMa, existsSync: _existsSyncMa } = await import("node:fs");
	const { join: _joinMa, dirname: _dirnameMa } = await import("node:path");
	const { fileURLToPath: _fileURLToPathMa } = await import("node:url");
	const _maDirname = _dirnameMa(_fileURLToPathMa(import.meta.url));
	const _maPackageRoot = _joinMa(_maDirname, "../../..");
	const _maCurrentMdPath = _joinMa(projectRoot, ".indusk/current.md");
	if (_existsSyncMa(_maCurrentMdPath)) {
		console.info("  ok: .indusk/current.md (already exists, preserving user state)");
	} else {
		const _maTemplate = _joinMa(_maPackageRoot, "templates/current.md");
		if (_existsSyncMa(_maTemplate)) {
			_cpSyncMa(_maTemplate, _maCurrentMdPath);
			console.info("  create: .indusk/current.md (from template)");
		} else {
			console.info("  skip: .indusk/current.md (template not found)");
		}
	}
	const _maConfig = readConfig(projectRoot);
	const _maHasAgents = (_maConfig as unknown as { agents?: { stale_ttl_minutes?: number } } | null)
		?.agents?.stale_ttl_minutes;
	if (_maConfig && typeof _maHasAgents !== "number") {
		writeConfig(projectRoot, {
			..._maConfig,
			agents: { stale_ttl_minutes: 60 },
		} as typeof _maConfig);
		console.info("  add: agents.stale_ttl_minutes: 60 to .indusk/config.json");
	} else if (typeof _maHasAgents === "number") {
		console.info(`  ok: agents.stale_ttl_minutes: ${_maHasAgents} (already set)`);
	}

	// 8. Ensure ignores: in full mode, refresh tracked .gitignore. In local
	// mode, leave .gitignore untouched and refresh .git/info/exclude (per-clone,
	// never committed) so InDusk patterns ignore correctly without a PR diff.
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
	const { addProject, touchProject, validateProject } = await import("../../lib/admin/registry.js");
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

	// Non-blocking version notice. Uses the 6h-cached lookup so we don't
	// hit npm on every invocation. Silently no-ops when offline, when the
	// cache is empty and the network fails, or when INDUSK_SKIP_UPDATE_CHECK=1.
	// This is the ONLY place `indusk update` touches the npm registry — and
	// it never installs anything. See `bin/commands/upgrade.ts` for the
	// install path.
	try {
		const check = await checkLatestVersion();
		if (hasNewerVersion(currentVersion, check.latestVersion)) {
			console.info(
				`\nv${check.latestVersion} is available (current: v${currentVersion}). Run \`indusk upgrade\`.`,
			);
		}
	} catch {
		// Best-effort — never let the notice break the update.
	}
}
