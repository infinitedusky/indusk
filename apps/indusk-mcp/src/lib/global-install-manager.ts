/**
 * Detect which global-install package manager owns the on-PATH `indusk`
 * binary, and build the right install command for it.
 *
 * The self-update flow in `commands/update.ts` historically hardcoded
 * `npm i -g`, which is wrong whenever the user installed via pnpm or bun:
 * `npm i -g` writes to npm's prefix (typically homebrew or nvm), while
 * the actual `indusk` on PATH lives under pnpm's or bun's prefix. The
 * install reports success but the resolved binary's version never changes,
 * so every subsequent `indusk update` re-detects "update available" and
 * loops forever from the user's perspective.
 *
 * Detection is path-string based — robust to symlinks (we look at the
 * binary path that `which` returned, not its realpath) and to the fact
 * that pnpm/bun shims aren't symlinks at all.
 */
export type GlobalInstallManager = "pnpm" | "bun" | "npm";

/**
 * Map an on-PATH `indusk` binary path to the package manager that installed
 * it. Returns null for unknown locations or empty input.
 *
 * pnpm: `~/Library/pnpm/indusk` (macOS), `~/.local/share/pnpm/indusk`
 *   (Linux), `%LOCALAPPDATA%\pnpm\indusk` (Windows). Detection key: the
 *   path contains `/pnpm/` (or `\pnpm\`) as a segment.
 * bun: `~/.bun/bin/indusk`. Detection key: contains `/.bun/`.
 * npm: anything under a `node_modules/.bin` ancestor, or homebrew's
 *   `/opt/homebrew/bin`, or nvm's per-version `bin/` dirs. Default for
 *   everything that didn't match pnpm or bun.
 */
export function detectGlobalManagerFromPath(
	binaryPath: string | null | undefined,
): GlobalInstallManager | null {
	if (!binaryPath) return null;
	const normalized = binaryPath.replace(/\\/g, "/");
	if (/\/pnpm\//.test(normalized)) return "pnpm";
	if (/\/\.bun\//.test(normalized)) return "bun";
	return "npm";
}

/**
 * Build the global-install command for a given manager + version. Returned
 * as a single shell-safe string suitable for `execSync` (version is pinned
 * with `@${version}`; the package name is a fixed literal).
 */
export function installCommandFor(manager: GlobalInstallManager, version: string): string {
	const pkg = `@infinitedusky/indusk-mcp@${version}`;
	switch (manager) {
		case "pnpm":
			return `pnpm add -g ${pkg}`;
		case "bun":
			return `bun install -g ${pkg}`;
		case "npm":
			return `npm i -g ${pkg}`;
	}
}

/**
 * Human-readable name for error/help messages. Same string the user would
 * type to recover manually.
 */
export function managerLabel(manager: GlobalInstallManager): string {
	return manager;
}
