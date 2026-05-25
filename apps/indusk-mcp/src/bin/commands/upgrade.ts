/**
 * `indusk upgrade` — install a newer version of the indusk-mcp global CLI.
 *
 * Split out from `indusk update` (which used to do both project-state
 * syncing AND CLI self-install in one breath, with a recursive
 * re-invocation that could silently loop forever — see issue Sandy hit
 * 2026-05-15 where `npm i -g` installed to homebrew's prefix while the
 * on-PATH `indusk` lived under pnpm and never moved).
 *
 * This command:
 *  1. Reads the current globally-resolved binary's version via `indusk
 *     --version`, not the running process's package.json (which can be a
 *     dev-from-source workspace copy).
 *  2. Fetches the latest npm version, bypassing any cached value (explicit
 *     upgrade is always a fresh check).
 *  3. Detects the package manager that owns the on-PATH binary by
 *     inspecting its path string.
 *  4. Runs the manager-appropriate install command.
 *  5. Verifies post-install by re-spawning `indusk --version` and
 *     comparing to the expected latest. If the version didn't move,
 *     prints a diagnostic with the PATH binary location, the install
 *     destination, and the manual recovery command. No recursive
 *     re-invocation, ever.
 *
 * Exits non-zero on any failure (network, install, verify) so wrappers
 * and CI can act on it.
 */

import { execFileSync, execSync, spawnSync } from "node:child_process";
import {
	detectGlobalManagerFromPath,
	type GlobalInstallManager,
	installCommandFor,
} from "../../lib/global-install-manager.js";
import { checkLatestVersion } from "../../lib/version-check.js";

function whichIndusk(): string | null {
	try {
		const out = execFileSync("which", ["indusk"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.trim()
			.split("\n")[0]
			?.trim();
		return out && out.length > 0 ? out : null;
	} catch {
		return null;
	}
}

function readBinaryVersion(): string | null {
	try {
		const out = execFileSync("indusk", ["--version"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 10_000,
		}).trim();
		// `commander` prints just the version string, possibly with a leading "v"
		return out.replace(/^v/, "");
	} catch {
		return null;
	}
}

function npmGlobalRoot(): string | null {
	try {
		return execFileSync("npm", ["root", "-g"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 10_000,
		}).trim();
	} catch {
		return null;
	}
}

function runInstall(
	command: string,
	timeoutMs = 120_000,
): { ok: true } | { ok: false; error: string } {
	try {
		execSync(command, {
			stdio: "inherit",
			timeout: timeoutMs,
		});
		return { ok: true };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message };
	}
}

export interface UpgradeOptions {
	/** Skip the npm version check and force an install of `latest`. */
	force?: boolean;
}

export async function upgrade(opts: UpgradeOptions = {}): Promise<void> {
	const binaryPath = whichIndusk();
	if (!binaryPath) {
		console.error(
			"No global `indusk` binary on PATH. First-time install: choose one — `npm i -g @infinitedusky/indusk-mcp`, `pnpm add -g @infinitedusky/indusk-mcp`, or `bun install -g @infinitedusky/indusk-mcp`.",
		);
		process.exit(1);
	}

	const currentVersion = readBinaryVersion();
	if (currentVersion === null) {
		console.error(
			`Found \`indusk\` at ${binaryPath} but \`indusk --version\` failed. The install is broken; reinstall manually.`,
		);
		process.exit(1);
	}

	const check = await checkLatestVersion({ bypassCache: true });
	const targetVersion = opts.force ? "latest" : check.latestVersion;

	if (!opts.force) {
		if (targetVersion === null) {
			console.error(
				"Could not reach the npm registry. Try again, or run `indusk upgrade --force` to install latest.",
			);
			process.exit(1);
		}
		if (targetVersion === currentVersion) {
			console.info(`indusk-mcp is already at v${currentVersion}.`);
			return;
		}
	}

	const manager: GlobalInstallManager | null = detectGlobalManagerFromPath(binaryPath);
	if (manager === null) {
		// detectGlobalManagerFromPath returns null only for empty input,
		// which we've already guarded against. This branch is structural
		// belt-and-suspenders; if we land here, surface the path so the
		// user can self-diagnose.
		console.error(
			`Unrecognized install location for \`indusk\` (${binaryPath}). Reinstall manually with your package manager.`,
		);
		process.exit(1);
	}

	const versionForCommand = opts.force ? "latest" : (targetVersion as string);
	const installCommand = installCommandFor(manager, versionForCommand);
	console.info(`Upgrading indusk-mcp via ${manager}: ${installCommand}`);
	const install = runInstall(installCommand);
	if (!install.ok) {
		console.error(`\nInstall failed: ${install.error}`);
		console.error(`Run manually: ${installCommand}`);
		process.exit(1);
	}

	const afterVersion = readBinaryVersion();
	if (afterVersion === null) {
		console.error(
			`\nInstall reported success, but \`indusk --version\` failed after the upgrade. Inspect ${binaryPath}.`,
		);
		process.exit(1);
	}

	const expected = opts.force ? null : (targetVersion as string);
	const versionChanged = afterVersion !== currentVersion;
	const matchesExpected = expected === null ? true : afterVersion === expected;

	if (!versionChanged || !matchesExpected) {
		const npmRoot = npmGlobalRoot();
		console.error("\n┃ Upgrade verification FAILED.");
		console.error(`┃   on-PATH binary: ${binaryPath}`);
		console.error(`┃   version before: ${currentVersion}`);
		console.error(`┃   version after:  ${afterVersion}`);
		if (expected !== null) console.error(`┃   expected:       ${expected}`);
		console.error(`┃   package manager: ${manager}`);
		if (npmRoot) console.error(`┃   npm -g prefix:  ${npmRoot}`);
		console.error("┃");
		console.error("┃ The install command exited 0 but the resolved binary did not change.");
		console.error(
			"┃ Likely cause: the install command targeted a different prefix than the one on PATH.",
		);
		console.error("┃ Verify with: `which indusk` and your package manager's global-list command.");
		process.exit(1);
	}

	console.info(`\nindusk-mcp upgraded: v${currentVersion} → v${afterVersion}.`);
	console.info("Restart Claude Code to pick up the new MCP server.");

	// Best-effort: clear the npx cache so older cached invocations don't
	// keep firing the previous version. Errors are non-fatal.
	try {
		spawnSync("sh", ["-c", "rm -rf ~/.npm/_npx/*"], { stdio: "ignore", timeout: 5_000 });
	} catch {
		// ignore
	}
}
