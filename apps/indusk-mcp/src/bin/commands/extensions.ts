import { execSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import {
	disabledDir,
	disableExtension,
	type ExtensionManifest,
	enableExtension,
	ensureExtensionsDirs,
	extensionConfigDir,
	extensionsDir,
	getEnabledExtensions,
	isEnabled,
	loadExtension,
	loadExtensions,
	resolveManifestPath,
} from "../../lib/extension-loader.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "../../..");
const builtinDir = join(packageRoot, "extensions");

function getBuiltinExtensions(): ExtensionManifest[] {
	if (!existsSync(builtinDir)) return [];
	const dirs = globSync("*/manifest.json", { cwd: builtinDir });
	return dirs
		.map((d) => loadExtension(join(builtinDir, d)))
		.filter((m): m is ExtensionManifest => m !== null);
}

export async function extensionsList(projectRoot: string): Promise<void> {
	const builtins = getBuiltinExtensions();
	const installed = loadExtensions(projectRoot);

	console.info("Built-in extensions:\n");
	for (const ext of builtins) {
		const status = isEnabled(projectRoot, ext.name)
			? "enabled"
			: installed.some((i) => i.manifest.name === ext.name)
				? "disabled"
				: "not installed";
		console.info(`  ${ext.name} — ${ext.description} [${status}]`);
	}

	const thirdParty = installed.filter((i) => !builtins.some((b) => b.name === i.manifest.name));
	if (thirdParty.length > 0) {
		console.info("\nThird-party extensions:\n");
		for (const ext of thirdParty) {
			const status = ext.enabled ? "enabled" : "disabled";
			console.info(`  ${ext.manifest.name} — ${ext.manifest.description} [${status}]`);
		}
	}
}

export async function extensionsStatus(projectRoot: string): Promise<void> {
	const enabled = getEnabledExtensions(projectRoot);

	if (enabled.length === 0) {
		console.info("No extensions enabled. Run `extensions list` to see available.");
		return;
	}

	console.info("Enabled extensions:\n");
	for (const ext of enabled) {
		const checks = ext.manifest.provides.health_checks ?? [];
		let healthStatus = "no health check";

		if (checks.length > 0) {
			const results = checks.map((check) => {
				try {
					execSync(check.command, {
						cwd: projectRoot,
						timeout: 10000,
						stdio: ["ignore", "pipe", "pipe"],
					});
					return { name: check.name, ok: true };
				} catch {
					return { name: check.name, ok: false };
				}
			});
			const allOk = results.every((r) => r.ok);
			healthStatus = allOk
				? "healthy"
				: `unhealthy: ${results
						.filter((r) => !r.ok)
						.map((r) => r.name)
						.join(", ")}`;
		}

		const source = ext.manifest._source ? ` (from ${ext.manifest._source})` : " (built-in)";

		console.info(`  ${ext.manifest.name}${source} — ${healthStatus}`);
	}
}

export async function extensionsEnable(projectRoot: string, names: string[]): Promise<void> {
	ensureExtensionsDirs(projectRoot);

	for (const name of names) {
		// Check if already enabled — still refresh `.env.example` so users
		// pick up updated field documentation on each `indusk update`.
		if (isEnabled(projectRoot, name)) {
			copyExtensionAssets(projectRoot, name);
			console.info(`  ${name}: already enabled`);
			printEnvSetupHint(projectRoot, name);
			printMcpSetup(projectRoot, name);
			continue;
		}

		// Check if extension requires auth — if so, .env must exist before enabling
		const builtinManifest = join(builtinDir, name, "manifest.json");
		if (existsSync(builtinManifest)) {
			const manifest = loadExtension(builtinManifest);
			if (manifest?.mcp_server?.headers && Object.keys(manifest.mcp_server.headers).length > 0) {
				const envVars = readExtensionEnv(name);
				if (Object.keys(envVars).length === 0) {
					// Copy `.env.example` (if shipped) BEFORE refusing, so the
					// user has a concrete template documenting every required
					// field. Without this, they'd have to read setup_instructions
					// to know what vars the extension needs.
					copyExtensionAssets(projectRoot, name);
					const examplePath = join(extensionConfigDir(projectRoot, name), ".env.example");

					console.info(`\n  ${name}: cannot enable — no credentials found.`);
					if (existsSync(examplePath)) {
						console.info(`    A template is at .indusk/extensions/${name}/.env.example`);
						console.info(
							`      cp .indusk/extensions/${name}/.env.example .indusk/extensions/${name}/.env`,
						);
						console.info(`    Then edit .env and fill in values (see inline comments).`);
					} else {
						console.info(
							`    Create .indusk/extensions/${name}/.env with the required credentials first.`,
						);
					}
					console.info(
						`    If using composable.env: run 'pnpm ce env:build' to generate it from your contract.`,
					);
					console.info(`    Then run 'extensions enable ${name}' again.\n`);
					continue;
				}
			}
		}

		// Try to move from disabled
		if (enableExtension(projectRoot, name)) {
			copyExtensionAssets(projectRoot, name);
			console.info(`  ${name}: enabled (was disabled)`);
			runHook(projectRoot, name, "on_init");
			runHook(projectRoot, name, "on_enable");
			installSkill(projectRoot, name);
			printEnvSetupHint(projectRoot, name);
			printMcpSetup(projectRoot, name);
			continue;
		}

		// Try to copy from built-in
		if (existsSync(builtinManifest)) {
			const targetDir = extensionConfigDir(projectRoot, name);
			mkdirSync(targetDir, { recursive: true });
			cpSync(builtinManifest, join(targetDir, "manifest.json"));
			copyExtensionAssets(projectRoot, name);
			console.info(`  ${name}: enabled (built-in)`);
			runHook(projectRoot, name, "on_init");
			runHook(projectRoot, name, "on_enable");
			installSkill(projectRoot, name);
			printEnvSetupHint(projectRoot, name);
			printMcpSetup(projectRoot, name);
			continue;
		}

		// Try npm as last resort
		console.info(`  ${name}: not built-in, trying npm...`);
		try {
			await extensionsAdd(projectRoot, name, name);
			if (isEnabled(projectRoot, name)) {
				continue;
			}
		} catch {
			// npm lookup failed, fall through
		}

		console.info(
			`  ${name}: not found as built-in or npm package — use 'extensions add ${name} --from <source>' for third-party`,
		);
	}
}

export async function extensionsDisable(projectRoot: string, names: string[]): Promise<void> {
	for (const name of names) {
		// Fire on_disable BEFORE renaming the manifest dir — the hook typically
		// needs to read the manifest to know what cleanup to do (e.g.,
		// local-telemetry's hook runs `indusk telemetry deregister $(pwd)`).
		// `runHook` reads the manifest from the enabled path, so it must run
		// while the extension is still enabled.
		if (isEnabled(projectRoot, name)) {
			runHook(projectRoot, name, "on_disable");
		}
		if (disableExtension(projectRoot, name)) {
			console.info(`  ${name}: disabled`);
		} else {
			console.info(`  ${name}: not found or already disabled`);
		}
	}
}

export async function extensionsAdd(
	projectRoot: string,
	name: string,
	from: string,
): Promise<void> {
	ensureExtensionsDirs(projectRoot);

	let manifestContent: string | null = null;

	if (from.startsWith("npm:")) {
		// Fetch from npm package by downloading tarball and extracting the manifest
		const pkg = from.slice(4);
		try {
			// npm pack downloads the tarball to cwd
			const tmpDir = join(projectRoot, ".indusk/tmp");
			mkdirSync(tmpDir, { recursive: true });
			execSync(`npm pack ${pkg} --pack-destination "${tmpDir}"`, {
				encoding: "utf-8",
				timeout: 30000,
				stdio: ["ignore", "pipe", "pipe"],
			});
			// Find the tarball
			const tarballs = readdirSync(tmpDir).filter((f) => f.endsWith(".tgz"));
			if (tarballs.length === 0) {
				console.info(`  ${name}: failed to download ${pkg}`);
				return;
			}
			// Extract indusk-extension.json from the tarball
			try {
				manifestContent = execSync(
					`tar -xzf "${join(tmpDir, tarballs[tarballs.length - 1])}" -O package/indusk-extension.json`,
					{ encoding: "utf-8", timeout: 10000 },
				);
			} catch {
				console.info(`  ${name}: no indusk-extension.json found in ${pkg}`);
				// Cleanup
				rmSync(tmpDir, { recursive: true, force: true });
				return;
			}
			// Cleanup
			rmSync(tmpDir, { recursive: true, force: true });
		} catch {
			console.info(`  ${name}: failed to fetch from npm:${pkg}`);
			return;
		}
	} else if (from.startsWith("github:")) {
		// Fetch from GitHub raw
		const repo = from.slice(7);
		const url = `https://raw.githubusercontent.com/${repo}/main/indusk-extension.json`;
		try {
			const result = execSync(`curl -sf "${url}"`, { encoding: "utf-8", timeout: 15000 });
			manifestContent = result;
		} catch {
			console.info(`  ${name}: failed to fetch from ${url}`);
			return;
		}
	} else if (from.startsWith("http://") || from.startsWith("https://")) {
		try {
			manifestContent = execSync(`curl -sf "${from}"`, { encoding: "utf-8", timeout: 15000 });
		} catch {
			console.info(`  ${name}: failed to fetch from ${from}`);
			return;
		}
	} else {
		// Local path — or fall back to npm if file doesn't exist
		if (existsSync(from)) {
			manifestContent = readFileSync(from, "utf-8");
		} else {
			// Try as npm package name
			const pkg = from;
			try {
				const tmpDir = join(projectRoot, ".indusk/tmp");
				mkdirSync(tmpDir, { recursive: true });
				execSync(`npm pack ${pkg} --pack-destination "${tmpDir}"`, {
					encoding: "utf-8",
					timeout: 30000,
					stdio: ["ignore", "pipe", "pipe"],
				});
				const tarballs = readdirSync(tmpDir).filter((f) => f.endsWith(".tgz"));
				if (tarballs.length > 0) {
					try {
						manifestContent = execSync(
							`tar -xzf "${join(tmpDir, tarballs[tarballs.length - 1])}" -O package/indusk-extension.json`,
							{ encoding: "utf-8", timeout: 10000 },
						);
					} catch {
						console.info(`  ${name}: no indusk-extension.json found in npm package ${pkg}`);
					}
				}
				rmSync(tmpDir, { recursive: true, force: true });
			} catch {
				console.info(`  ${name}: not found as local file or npm package: ${from}`);
				return;
			}
		}
	}

	if (!manifestContent) return;

	// Validate
	try {
		const manifest = JSON.parse(manifestContent);
		if (!manifest.name || !manifest.provides) {
			console.info(`  ${name}: invalid manifest (missing name or provides)`);
			return;
		}
	} catch {
		console.info(`  ${name}: invalid JSON in manifest`);
		return;
	}

	// Store the source in the manifest so `extensions update` can re-fetch
	try {
		const parsed = JSON.parse(manifestContent);
		parsed._source = from;
		manifestContent = JSON.stringify(parsed, null, "\t");
	} catch {
		// leave as-is if parsing fails
	}

	// If source is npm, install the underlying package
	if (from.startsWith("npm:")) {
		installNpmPackage(projectRoot, name, from.slice(4));
	}

	const targetDir = extensionConfigDir(projectRoot, name);
	mkdirSync(targetDir, { recursive: true });
	writeFileSync(join(targetDir, "manifest.json"), manifestContent);
	console.info(`  ${name}: added from ${from}`);

	// Run post-update hook if defined
	try {
		const manifest = JSON.parse(manifestContent);
		if (manifest.hooks?.on_post_update) {
			console.info(`  ${name}: running post-update hook...`);
			try {
				execSync(manifest.hooks.on_post_update, {
					cwd: projectRoot,
					timeout: 30000,
					stdio: ["ignore", "pipe", "pipe"],
				});
				console.info(`  ${name}: post-update hook completed`);
			} catch (e: unknown) {
				const err = e as { stderr?: string };
				console.info(
					`  ${name}: post-update hook failed: ${err.stderr?.trim() ?? "unknown error"}`,
				);
			}
		}
	} catch {
		// ignore parse errors
	}
}

function getInstalledVersion(projectRoot: string, pkg: string): string | null {
	try {
		const pkgJson = join(projectRoot, "node_modules", pkg, "package.json");
		if (existsSync(pkgJson)) {
			return JSON.parse(readFileSync(pkgJson, "utf-8")).version ?? null;
		}
	} catch {
		// ignore
	}
	return null;
}

function installNpmPackage(projectRoot: string, extName: string, pkg: string): void {
	const pm = existsSync(join(projectRoot, "pnpm-lock.yaml"))
		? "pnpm"
		: existsSync(join(projectRoot, "yarn.lock"))
			? "yarn"
			: "npm";
	const isWorkspace = existsSync(join(projectRoot, "pnpm-workspace.yaml"));
	const addCmd =
		pm === "pnpm"
			? `pnpm add -D ${isWorkspace ? "-w " : ""}${pkg}@latest`
			: pm === "yarn"
				? `yarn add -D ${pkg}@latest`
				: `npm install -D ${pkg}@latest`;

	console.info(`  ${extName}: running ${addCmd}...`);
	try {
		execSync(addCmd, {
			cwd: projectRoot,
			timeout: 60000,
			encoding: "utf-8",
		});
		console.info(`  ${extName}: package installed`);
	} catch {
		console.info(`  ${extName}: auto-install failed. Run manually: ${addCmd}`);
	}
}

export async function extensionsRemove(projectRoot: string, names: string[]): Promise<void> {
	for (const name of names) {
		// Directory format
		const enDir = extensionConfigDir(projectRoot, name);
		const disDir = join(disabledDir(projectRoot), name);
		// Legacy flat
		const enFlat = join(extensionsDir(projectRoot), `${name}.json`);
		const disFlat = join(disabledDir(projectRoot), `${name}.json`);

		if (existsSync(join(enDir, "manifest.json"))) {
			rmSync(enDir, { recursive: true });
			console.info(`  ${name}: removed`);
		} else if (existsSync(enFlat)) {
			rmSync(enFlat);
			console.info(`  ${name}: removed`);
		} else if (existsSync(join(disDir, "manifest.json"))) {
			rmSync(disDir, { recursive: true });
			console.info(`  ${name}: removed (was disabled)`);
		} else if (existsSync(disFlat)) {
			rmSync(disFlat);
			console.info(`  ${name}: removed (was disabled)`);
		} else {
			console.info(`  ${name}: not found`);
		}

		// Remove skill if installed
		const skillDir = join(projectRoot, ".claude/skills", name);
		if (existsSync(skillDir)) {
			rmSync(skillDir, { recursive: true });
			console.info(`  ${name}: skill removed from .claude/skills/`);
		}
	}
}

export async function extensionsUpdate(projectRoot: string, names?: string[]): Promise<void> {
	const extDir = extensionsDir(projectRoot);
	if (!existsSync(extDir)) {
		console.info("No extensions installed.");
		return;
	}

	// Find all third-party extensions (ones with _source)
	const enabled = getEnabledExtensions(projectRoot);
	let updated = 0;

	for (const ext of enabled) {
		const name = ext.manifest.name;
		if (names?.length && !names.includes(name)) continue;

		try {
			if (!ext.manifest._source) {
				if (names?.includes(name)) {
					console.info(
						`  ${name}: built-in extension — updated via package update, not extensions update`,
					);
				}
				continue;
			}

			const source = ext.manifest._source;

			if (source.startsWith("npm:")) {
				const pkg = source.slice(4);

				// Check what version is currently installed
				const oldVersion = getInstalledVersion(projectRoot, pkg);

				// Install latest
				installNpmPackage(projectRoot, name, pkg);

				// Check new version
				const newVersion = getInstalledVersion(projectRoot, pkg);

				if (oldVersion && newVersion && oldVersion === newVersion) {
					console.info(`  ${name}: already on latest (${newVersion})`);
					continue;
				}

				console.info(`  ${name}: ${oldVersion ?? "unknown"} → ${newVersion ?? "latest"}`);

				// Read manifest from installed package (no second download)
				const manifestPath = join(projectRoot, "node_modules", pkg, "indusk-extension.json");
				if (existsSync(manifestPath)) {
					const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
					manifest._source = source;
					const extManifestDir = join(extensionsDir(projectRoot), name);
					mkdirSync(extManifestDir, { recursive: true });
					writeFileSync(
						join(extManifestDir, "manifest.json"),
						`${JSON.stringify(manifest, null, "\t")}\n`,
					);
					console.info(`  ${name}: manifest updated`);
				}
			} else {
				console.info(`  ${name}: updating from ${source}...`);
				await extensionsAdd(projectRoot, name, source);
			}

			// Run post-update hook if present
			const updatedManifest = ext.manifest;
			if (updatedManifest.hooks?.on_post_update) {
				console.info(`  ${name}: running post-update hook...`);
				try {
					execSync(updatedManifest.hooks.on_post_update, {
						cwd: projectRoot,
						timeout: 30000,
						stdio: ["ignore", "pipe", "pipe"],
					});
					console.info(`  ${name}: post-update hook completed`);
				} catch {
					console.info(`  ${name}: post-update hook failed`);
				}
			}

			updated++;
		} catch (e: unknown) {
			const err = e as { message?: string };
			console.info(`  ${name}: failed to read manifest: ${err.message ?? "unknown"}`);
		}
	}

	if (updated === 0) {
		console.info("No third-party extensions to update.");
	} else {
		console.info(`\n${updated} extension(s) updated.`);
		console.info("\n⚠  Restart Claude Code to load the updated extensions.");
	}
}

export async function extensionsSuggest(projectRoot: string): Promise<void> {
	const builtins = getBuiltinExtensions();
	const suggestions: { name: string; reason: string }[] = [];

	for (const ext of builtins) {
		if (isEnabled(projectRoot, ext.name)) continue;
		if (!ext.detect) continue;

		if (ext.detect.file && existsSync(join(projectRoot, ext.detect.file))) {
			suggestions.push({ name: ext.name, reason: `${ext.detect.file} found` });
			continue;
		}

		if (ext.detect.file_pattern) {
			const matches = globSync(ext.detect.file_pattern, { cwd: projectRoot, maxDepth: 3 });
			if (matches.length > 0) {
				suggestions.push({ name: ext.name, reason: `${ext.detect.file_pattern} found` });
				continue;
			}
		}

		if (ext.detect.dependency || ext.detect.devDependency) {
			const pkgPath = join(projectRoot, "package.json");
			if (existsSync(pkgPath)) {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
				const deps = pkg.dependencies ?? {};
				const devDeps = pkg.devDependencies ?? {};
				if (ext.detect.dependency && deps[ext.detect.dependency]) {
					suggestions.push({ name: ext.name, reason: `${ext.detect.dependency} in dependencies` });
				} else if (ext.detect.devDependency && devDeps[ext.detect.devDependency]) {
					suggestions.push({
						name: ext.name,
						reason: `${ext.detect.devDependency} in devDependencies`,
					});
				}
			}
		}

		if (ext.detect.mcp_server) {
			try {
				const mcpPath = join(projectRoot, ".mcp.json");
				if (existsSync(mcpPath)) {
					const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
					if (mcp.mcpServers?.[ext.detect.mcp_server]) {
						suggestions.push({ name: ext.name, reason: `${ext.detect.mcp_server} in .mcp.json` });
					}
				}
			} catch {
				// ignore
			}
		}
	}

	if (suggestions.length === 0) {
		console.info("No extension suggestions — all detected extensions are already enabled.");
		return;
	}

	console.info("Suggested extensions:\n");
	for (const s of suggestions) {
		console.info(`  ${s.name} — ${s.reason}`);
	}
	console.info(`\nEnable with: extensions enable ${suggestions.map((s) => s.name).join(" ")}`);
}

export async function autoEnableExtensions(projectRoot: string): Promise<void> {
	const { isExtensionExplicitlyDisabled } = await import("../../lib/config.js");
	const builtins = getBuiltinExtensions();
	let enabled = 0;

	// Pass 1: required-by-default extensions. These enable unconditionally
	// unless the project has explicitly opted out via `disabled_extensions`
	// in `.indusk/config.json`. Runs BEFORE detection-based enables so that
	// detection-driven dependencies on required substrate resolve against
	// an already-enabled required set.
	for (const ext of builtins) {
		if (!ext.required) continue;
		if (isEnabled(projectRoot, ext.name)) continue;
		if (isExtensionExplicitlyDisabled(projectRoot, ext.name)) {
			console.info(`  ${ext.name}: skipped (disabled_extensions in .indusk/config.json)`);
			continue;
		}
		await extensionsEnable(projectRoot, [ext.name]);
		console.info(`    (required-by-default)`);
		enabled++;
	}

	// Pass 2: detection-based auto-enable (the original flow).
	for (const ext of builtins) {
		if (isEnabled(projectRoot, ext.name)) continue;
		if (ext.required) continue; // already handled in Pass 1
		if (!ext.detect) continue;

		let detected = false;
		let reason = "";

		if (ext.detect.file && existsSync(join(projectRoot, ext.detect.file))) {
			detected = true;
			reason = `${ext.detect.file} found`;
		}

		if (!detected && ext.detect.file_pattern) {
			const matches = globSync(ext.detect.file_pattern, { cwd: projectRoot, maxDepth: 3 });
			if (matches.length > 0) {
				detected = true;
				reason = `${ext.detect.file_pattern} found`;
			}
		}

		if (!detected && (ext.detect.dependency || ext.detect.devDependency)) {
			const pkgPath = join(projectRoot, "package.json");
			if (existsSync(pkgPath)) {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
				const deps = pkg.dependencies ?? {};
				const devDeps = pkg.devDependencies ?? {};
				if (ext.detect.dependency && deps[ext.detect.dependency]) {
					detected = true;
					reason = `${ext.detect.dependency} in dependencies`;
				} else if (ext.detect.devDependency && devDeps[ext.detect.devDependency]) {
					detected = true;
					reason = `${ext.detect.devDependency} in devDependencies`;
				}
			}
		}

		if (!detected && ext.detect.mcp_server) {
			try {
				const mcpPath = join(projectRoot, ".mcp.json");
				if (existsSync(mcpPath)) {
					const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
					if (mcp.mcpServers?.[ext.detect.mcp_server]) {
						detected = true;
						reason = `${ext.detect.mcp_server} in .mcp.json`;
					}
				}
			} catch {
				// ignore parse errors
			}
		}

		if (detected) {
			await extensionsEnable(projectRoot, [ext.name]);
			console.info(`    (detected: ${reason})`);
			enabled++;
		}
	}

	if (enabled === 0) {
		console.info("  No new extensions detected.");
	}
}

// --- Helpers ---

/**
 * Copy reference assets from the built-in extension source dir into the
 * project's `.indusk/extensions/{name}/`. Today this handles `.env.example`
 * — a documented template showing which env vars the extension needs.
 * Always overwrites the target so projects pick up updated field docs on
 * each `indusk update`; the user's real `.env` (if any) is never touched
 * (we only ever write `.env.example` from here, never `.env`).
 */
function copyExtensionAssets(projectRoot: string, name: string): void {
	const sourceExample = join(builtinDir, name, ".env.example");
	if (!existsSync(sourceExample)) return;
	const targetDir = extensionConfigDir(projectRoot, name);
	mkdirSync(targetDir, { recursive: true });
	cpSync(sourceExample, join(targetDir, ".env.example"));
}

/**
 * Whether an extension's `.env` file is functionally consumed (vs
 * reference-only). Today the signal is "has auth-required MCP headers" —
 * extensions with auth populate `.mcp.json` from `.env`, so a missing
 * `.env` means the MCP server can't be wired. Extensions without that
 * (local-telemetry, whose MCP is wired dynamically by the daemon; any
 * no-MCP extension) treat `.env.example` as documentation.
 *
 * Exported so `update.ts` can gate its inline hint on the same rule.
 */
export function envIsFunctional(name: string): boolean {
	const manifestPath = join(builtinDir, name, "manifest.json");
	if (!existsSync(manifestPath)) return false;
	const manifest = loadExtension(manifestPath);
	const headers = manifest?.mcp_server?.headers;
	return !!headers && Object.keys(headers).length > 0;
}

/**
 * After enable, nudge the user if this extension *functionally consumes*
 * `.env` (auth-required MCP server) AND no real `.env` exists yet. Silent
 * when:
 *  - no `.env.example` ships (nothing to point at)
 *  - the user has already created `.env` (they're configured)
 *  - the extension has no auth-required MCP server (`.env.example` is
 *    reference-only, e.g. local-telemetry's port documentation — copying
 *    it to `.env` wouldn't "activate" anything because nothing reads it)
 *
 * Runs before `printMcpSetup` so the actionable `cp` command appears at
 * the top of the extension's enable output.
 */
function printEnvSetupHint(projectRoot: string, name: string): void {
	const targetDir = extensionConfigDir(projectRoot, name);
	const examplePath = join(targetDir, ".env.example");
	const envPath = join(targetDir, ".env");
	if (!existsSync(examplePath)) return;
	if (existsSync(envPath)) return;
	if (!envIsFunctional(name)) return;
	console.info(`\n  ${name}: .env not found — copy the template to activate:`);
	console.info(`    cp .indusk/extensions/${name}/.env.example .indusk/extensions/${name}/.env`);
	console.info(`    Then edit .env and fill in values (see inline comments).`);
}

function runHook(projectRoot: string, name: string, hook: string): void {
	const manifestPath = resolveManifestPath(extensionsDir(projectRoot), name);
	if (!manifestPath) return;
	const manifest = loadExtension(manifestPath);
	if (!manifest?.hooks) return;
	const command = manifest.hooks[hook as keyof typeof manifest.hooks];
	if (!command) return;

	// `INDUSK_BIN` override — when set, substitute the bare `indusk ` prefix
	// for the explicit binary. This lets tests force hooks to run against a
	// specific dist (not the globally-installed `indusk`, which may be a
	// prior version) and gives preview users a clean override path.
	const bin = process.env.INDUSK_BIN;
	const effectiveCommand =
		bin && /^\s*indusk\s/.test(command) ? command.replace(/^\s*indusk\s/, `${bin} `) : command;

	try {
		execSync(effectiveCommand, {
			cwd: projectRoot,
			stdio: "inherit",
			timeout: 30000,
		});
	} catch {
		console.info(`  ${name}: ${hook} hook failed`);
	}
}

function printMcpSetup(projectRoot: string, name: string): void {
	const manifestPath = resolveManifestPath(extensionsDir(projectRoot), name);
	if (!manifestPath) {
		// Try built-in
		const builtinPath = join(builtinDir, name, "manifest.json");
		if (!existsSync(builtinPath)) return;
		const manifest = loadExtension(builtinPath);
		if (!manifest?.mcp_server) return;
		printMcpInstructions(name, manifest);
		return;
	}
	const manifest = loadExtension(manifestPath);
	if (!manifest?.mcp_server) return;
	printMcpInstructions(name, manifest);
}

function readExtensionEnv(name: string): Record<string, string> {
	const cwd = process.cwd();
	// Cascade priority (highest first, dotenv convention): .env.local
	// overrides .env. Disabled-state files are a fallback for re-enabling
	// an extension whose env files migrated under .indusk/disabled/.
	// Union semantics: walk highest-to-lowest, set only keys not already
	// set, so the highest-priority file wins per-key. Lets a project keep
	// shared defaults in `.env` and override individual keys in
	// `.env.local` without needing to duplicate the rest.
	const candidates = [
		join(cwd, ".indusk/extensions", name, ".env.local"),
		join(cwd, ".indusk/extensions", name, ".env"),
		join(cwd, ".indusk/disabled", name, ".env.local"),
		join(cwd, ".indusk/disabled", name, ".env"),
	];

	const merged: Record<string, string> = {};
	for (const envPath of candidates) {
		if (!existsSync(envPath)) continue;
		const content = readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx <= 0) continue;
			const key = trimmed.slice(0, eqIdx);
			if (key in merged) continue;
			merged[key] = trimmed.slice(eqIdx + 1);
		}
	}
	return merged;
}

function printMcpInstructions(name: string, manifest: ExtensionManifest): void {
	const server = manifest.mcp_server;
	if (!server) return;

	const needsAuth = server.headers && Object.keys(server.headers).length > 0;

	// Remove first, then add — ensures clean state
	try {
		execSync(`claude mcp remove -s project ${name}`, {
			timeout: 10000,
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		// not registered yet, fine
	}

	const serverType =
		server.type ?? ((server as Record<string, unknown>).transport as string | undefined);

	// Auto-run claude mcp add for no-auth stdio servers
	if (!needsAuth && serverType === "stdio" && server.command) {
		const args = server.args ? ` ${server.args.join(" ")}` : "";
		const cmd = `claude mcp add -t stdio -s project -- ${name} ${server.command}${args}`;
		console.info(`\n  ${name}: adding MCP server...`);
		try {
			execSync(cmd, { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
			console.info(`  ${name}: MCP server added (restart Claude Code to load)`);
		} catch {
			console.info(`  ${name}: auto-add failed. Run manually:`);
			console.info(`    ${cmd}`);
		}
		return;
	}

	// Auto-run claude mcp add for no-auth HTTP servers. Substitute any
	// env-var placeholders in `server.url` from the extension's .env so
	// manifests can ship a regional/template URL (e.g., Datadog uses
	// OAuth — no headers — but the URL still varies by region and is
	// configured via .env). Same substitution shape as the auth branch
	// below, just without the headers.
	if (!needsAuth && serverType === "http" && server.url) {
		const envVars = readExtensionEnv(name);
		let url = server.url;
		for (const [envKey, envVal] of Object.entries(envVars)) {
			url = url.replaceAll(envKey, envVal);
		}
		const cmd = `claude mcp add -t http -s project -- ${name} ${url}`;
		console.info(`\n  ${name}: adding MCP server...`);
		try {
			execSync(cmd, { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
			console.info(`  ${name}: MCP server added (restart Claude Code to load)`);
		} catch {
			console.info(`  ${name}: auto-add failed. Run manually:`);
			console.info(`    ${cmd}`);
		}
		return;
	}

	// For servers needing auth, try to read credentials from extension .env
	if (needsAuth && server.type === "http" && server.url && server.headers) {
		const envVars = readExtensionEnv(name);

		if (Object.keys(envVars).length > 0) {
			// Substitute placeholders in url and headers
			let url = server.url;
			for (const [envKey, envVal] of Object.entries(envVars)) {
				url = url.replaceAll(envKey, envVal);
			}

			const headerArgs: string[] = [];
			let allResolved = true;
			for (const [key, template] of Object.entries(server.headers)) {
				let resolved = template;
				for (const [envKey, envVal] of Object.entries(envVars)) {
					resolved = resolved.replaceAll(envKey, envVal);
				}
				if (resolved === template) {
					allResolved = false;
					break;
				}
				headerArgs.push(`--header "${key}: ${resolved}"`);
			}

			if (allResolved) {
				const args = [
					"mcp",
					"add",
					"-t",
					"http",
					...headerArgs.flatMap((h) => {
						const match = h.match(/--header "(.+): (.+)"/);
						if (match) return ["--header", `${match[1]}: ${match[2]}`];
						return [];
					}),
					"-s",
					"project",
					"--",
					name,
					url,
				];
				const cmd = `claude ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`;
				console.info(`\n  ${name}: adding MCP server with credentials from .env...`);
				// Remove existing entry first so we always write fresh credentials
				try {
					execSync(`claude mcp remove -s project ${name}`, {
						cwd: process.cwd(),
						timeout: 10000,
						stdio: ["ignore", "pipe", "pipe"],
					});
				} catch {
					// Ignore — may not exist
				}
				try {
					execSync(cmd, { cwd: process.cwd(), timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
					console.info(`  ${name}: MCP server configured (restart Claude Code to load)`);
					return;
				} catch (e: unknown) {
					const err = e as { stderr?: Buffer | string; message?: string };
					const stderr = err.stderr ? String(err.stderr).trim() : "";
					console.info(`  ${name}: auto-add failed. ${stderr || err.message || ""}`);
					console.info(`  command was: ${cmd}`);
					return;
				}
			}
		}
	}

	// Fallback: no .env found or credentials incomplete. When the extension
	// ships an `.env.example`, `printEnvSetupHint` already nudged the user
	// with the copy-the-template command — don't duplicate it here.
	const examplePath = join(process.cwd(), ".indusk/extensions", name, ".env.example");
	if (existsSync(examplePath)) return;

	console.info(`\n  ${name}: no credentials found at .indusk/extensions/${name}/.env`);
	console.info(`    To set up automatically:`);
	console.info(`      1. Create .indusk/extensions/${name}/.env with the required credentials`);
	console.info(`      2. Run 'extensions enable ${name}' again`);
	if (server.setup_instructions?.length) {
		console.info(`    Or set up manually:`);
		for (const instruction of server.setup_instructions) {
			console.info(`      ${instruction}`);
		}
	}
	console.info("");
}

function installSkill(projectRoot: string, name: string): void {
	const manifestPath = resolveManifestPath(extensionsDir(projectRoot), name);
	if (!manifestPath) return;
	const manifest = loadExtension(manifestPath);
	if (!manifest?.provides.skill) return;

	// Look for skill.md in built-in extensions
	const builtinSkill = join(builtinDir, name, "skill.md");
	if (existsSync(builtinSkill)) {
		const targetDir = join(projectRoot, ".claude/skills", name);
		mkdirSync(targetDir, { recursive: true });
		cpSync(builtinSkill, join(targetDir, "SKILL.md"));
		console.info(`  ${name}: skill installed to .claude/skills/${name}/SKILL.md`);
	}
}
