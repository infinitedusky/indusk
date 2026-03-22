import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { globSync } from "glob";
import {
	disableExtension,
	type ExtensionManifest,
	enableExtension,
	ensureExtensionsDirs,
	extensionsDir,
	getEnabledExtensions,
	isEnabled,
	loadExtension,
	loadExtensions,
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

		console.info(`  ${ext.manifest.name} — ${healthStatus}`);
	}
}

export async function extensionsEnable(projectRoot: string, names: string[]): Promise<void> {
	ensureExtensionsDirs(projectRoot);

	for (const name of names) {
		// Check if already enabled
		if (isEnabled(projectRoot, name)) {
			console.info(`  ${name}: already enabled`);
			continue;
		}

		// Try to move from disabled
		if (enableExtension(projectRoot, name)) {
			console.info(`  ${name}: enabled (was disabled)`);
			runHook(projectRoot, name, "on_init");
			installSkill(projectRoot, name);
			continue;
		}

		// Try to copy from built-in
		const builtinManifest = join(builtinDir, name, "manifest.json");
		if (existsSync(builtinManifest)) {
			const targetPath = join(extensionsDir(projectRoot), `${name}.json`);
			cpSync(builtinManifest, targetPath);
			console.info(`  ${name}: enabled (built-in)`);
			runHook(projectRoot, name, "on_init");
			installSkill(projectRoot, name);
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
		// Fetch from npm package
		const pkg = from.slice(4);
		try {
			const result = execSync(`npm pack ${pkg} --dry-run --json 2>/dev/null || echo "[]"`, {
				encoding: "utf-8",
				timeout: 30000,
			});
			// Try to read the manifest from the installed package
			const npmRoot = execSync(`npm root`, { encoding: "utf-8", cwd: projectRoot }).trim();
			const manifestPath = join(npmRoot, pkg, "indusk-extension.json");
			if (existsSync(manifestPath)) {
				manifestContent = readFileSync(manifestPath, "utf-8");
			} else {
				console.info(`  ${name}: no indusk-extension.json found in ${pkg}`);
				return;
			}
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

	const targetPath = join(extensionsDir(projectRoot), `${name}.json`);
	writeFileSync(targetPath, manifestContent);
	console.info(`  ${name}: added from ${from}`);
}

export async function extensionsRemove(projectRoot: string, names: string[]): Promise<void> {
	for (const name of names) {
		const enPath = join(extensionsDir(projectRoot), `${name}.json`);
		const disPath = join(extensionsDir(projectRoot), ".disabled", `${name}.json`);

		if (existsSync(enPath)) {
			rmSync(enPath);
			console.info(`  ${name}: removed`);
		} else if (existsSync(disPath)) {
			rmSync(disPath);
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

// --- Helpers ---

function runHook(projectRoot: string, name: string, hook: string): void {
	const extPath = join(extensionsDir(projectRoot), `${name}.json`);
	const manifest = loadExtension(extPath);
	if (!manifest?.hooks) return;
	const command = manifest.hooks[hook as keyof typeof manifest.hooks];
	if (!command) return;

	try {
		execSync(command, { cwd: projectRoot, stdio: "inherit", timeout: 30000 });
	} catch {
		console.info(`  ${name}: ${hook} hook failed`);
	}
}

function installSkill(projectRoot: string, name: string): void {
	const extPath = join(extensionsDir(projectRoot), `${name}.json`);
	const manifest = loadExtension(extPath);
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
