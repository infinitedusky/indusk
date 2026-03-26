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
	disableExtension,
	disabledDir,
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
		// Check if already enabled
		if (isEnabled(projectRoot, name)) {
			console.info(`  ${name}: already enabled`);
			printMcpSetup(projectRoot, name);
			continue;
		}

		// Try to move from disabled
		if (enableExtension(projectRoot, name)) {
			console.info(`  ${name}: enabled (was disabled)`);
			runHook(projectRoot, name, "on_init");
			installSkill(projectRoot, name);
			printMcpSetup(projectRoot, name);
			continue;
		}

		// Try to copy from built-in
		const builtinManifest = join(builtinDir, name, "manifest.json");
		if (existsSync(builtinManifest)) {
			const targetDir = extensionConfigDir(projectRoot, name);
			mkdirSync(targetDir, { recursive: true });
			cpSync(builtinManifest, join(targetDir, "manifest.json"));
			console.info(`  ${name}: enabled (built-in)`);
			runHook(projectRoot, name, "on_init");
			installSkill(projectRoot, name);
			printMcpSetup(projectRoot, name);
			continue;
		}

		console.info(
			`  ${name}: not found — use 'extensions add ${name} --from <source>' for third-party`,
		);
	}
}

export async function extensionsDisable(projectRoot: string, names: string[]): Promise<void> {
	for (const name of names) {
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
		// Local path
		if (existsSync(from)) {
			manifestContent = readFileSync(from, "utf-8");
		} else {
			console.info(`  ${name}: file not found at ${from}`);
			return;
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
				if (names && names.includes(name)) {
					console.info(
						`  ${name}: built-in extension — updated via package update, not extensions update`,
					);
				}
				continue;
			}

			const source = ext.manifest._source;
			console.info(`  ${name}: updating from ${source}...`);

			// If source is npm, update the installed package FIRST so we get the latest
			if (source.startsWith("npm:")) {
				installNpmPackage(projectRoot, name, source.slice(4));
			}

			// Then fetch the latest manifest (from the now-updated package)
			await extensionsAdd(projectRoot, name, source);
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
	const builtins = getBuiltinExtensions();
	let enabled = 0;

	for (const ext of builtins) {
		if (isEnabled(projectRoot, ext.name)) continue;
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

function runHook(projectRoot: string, name: string, hook: string): void {
	const manifestPath = resolveManifestPath(extensionsDir(projectRoot), name);
	if (!manifestPath) return;
	const manifest = loadExtension(manifestPath);
	if (!manifest?.hooks) return;
	const command = manifest.hooks[hook as keyof typeof manifest.hooks];
	if (!command) return;

	try {
		execSync(command, { cwd: projectRoot, stdio: "inherit", timeout: 30000 });
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

function printMcpInstructions(name: string, manifest: ExtensionManifest): void {
	const server = manifest.mcp_server;
	if (!server) return;

	const needsAuth = server.headers && Object.keys(server.headers).length > 0;

	// Auto-run claude mcp add for no-auth HTTP servers
	if (!needsAuth && server.type === "http" && server.url) {
		const cmd = `claude mcp add -t http -s project -- ${name} ${server.url}`;
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

	// For servers needing auth, print setup instructions
	if (server.setup_instructions?.length) {
		console.info(`\n  ${name} MCP setup:`);
		for (const instruction of server.setup_instructions) {
			console.info(`    ${instruction}`);
		}
	} else if (server.type === "http" && server.url) {
		console.info(`\n  ${name} MCP setup:`);
		console.info(`    claude mcp add -t http -- ${name} ${server.url}`);
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
