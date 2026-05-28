import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	daemonStart,
	daemonStatus,
	daemonStop,
	findFreePort,
	isPortListening,
} from "../../lib/admin/daemon.js";
import { readRegistry } from "../../lib/admin/registry.js";

/**
 * Resolve the browser URL path for a fresh `indusk ui` invocation. If the
 * current working directory matches a registered project's `path`, return
 * `/p/{name}/` so the user lands on that project directly. Otherwise fall
 * back to `/` (the project grid). This is T16's contract.
 *
 * Both sides are normalized via `realpathSync` so macOS's /var ↔ /private/var
 * symlink doesn't cause a false mismatch — `mkdtempSync` can return a path
 * with an unresolved leading component while `process.cwd()` returns the
 * fully-resolved realpath, so raw string compare misses.
 */
export function resolveOpenPath(): string {
	const reg = readRegistry();
	if (reg.projects.length === 0) return "/";

	// Precompute registered project realpaths once — cheap, and keeps the
	// walk-up loop body to a single string compare per ancestor.
	const projectRealpaths = reg.projects.map((p) => ({
		name: p.name,
		real: safeRealpath(p.path),
	}));

	// Walk up from cwd toward the filesystem root, checking each ancestor
	// against every registered project's realpath. First match wins — nearer
	// ancestors are more specific and should take precedence if the user
	// has nested project registrations (rare but possible with monorepo
	// submodules registered separately).
	let cur = safeRealpath(process.cwd());
	for (let i = 0; i < 40; i++) {
		const hit = projectRealpaths.find((p) => p.real === cur);
		if (hit) return `/p/${hit.name}/`;
		const parent = dirname(cur);
		if (parent === cur) break; // filesystem root reached
		cur = parent;
	}
	return "/";
}

function safeRealpath(p: string): string {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
}

export interface UiStartOptions {
	port: string;
	open: boolean;
}

/**
 * Start the admin-ui daemon. If already running, prints "already running"
 * and the existing URL without spawning a second daemon. Otherwise picks
 * a free port (respecting `--port`, auto-bumping on conflict), spawns the
 * bundled admin app via `daemonStart`, and opens the browser unless
 * `--no-open`.
 */
export async function uiStart(opts: UiStartOptions): Promise<void> {
	const openPath = resolveOpenPath();
	const existing = await daemonStatus();
	if (existing.running) {
		const url = `http://localhost:${existing.port}${openPath}`;
		console.info(`Admin UI is already running on ${url} (PID ${existing.pid}).`);
		if (opts.open) openBrowser(url);
		return;
	}

	const requested = Number.parseInt(opts.port, 10);
	if (!Number.isFinite(requested) || requested < 0 || requested > 65535) {
		console.error(`Invalid --port value: ${opts.port}`);
		process.exit(1);
	}

	const adminDir = resolveBundledAdminDir();
	if (!existsSync(adminDir) || !existsSync(join(adminDir, ".next/BUILD_ID"))) {
		console.error(
			`Admin UI bundle not found at ${adminDir}.\n` +
				"Reinstall indusk-mcp from npm, or rebuild from source with:\n" +
				"  pnpm --filter indusk-admin build && (cd apps/indusk-mcp && node scripts/bundle-admin.js)",
		);
		process.exit(1);
	}

	const nextBin = resolveNextBin();
	if (!nextBin) {
		console.error(
			"Could not resolve the 'next' binary from indusk-mcp. " +
				"Run `npm i` / `pnpm install` to restore dependencies.",
		);
		process.exit(1);
	}

	const port = await findFreePort(requested);
	if (port !== requested && requested !== 0) {
		console.warn(`Port ${requested} is in use; using ${port} instead.`);
	}

	const baseUrl = `http://localhost:${port}/`;
	console.info(`Starting admin UI on ${baseUrl}`);

	const meta = await daemonStart({ port, adminDir, nextBin });
	console.info(`  PID: ${meta.pid}`);
	console.info(`  Logs: ~/.indusk/admin-ui.log`);

	// Cwd-aware open URL (T16): lands on /p/{name}/ when run inside a
	// registered project, else falls through to /. Printing it in the CLI
	// output doubles as the test-assertion surface.
	const openUrl = `http://localhost:${port}${openPath}`;
	console.info(`Opening ${openUrl}`);

	if (opts.open) openBrowser(openUrl);
}

/**
 * Restart the admin-ui daemon: stop (if running) then start. Picks up any
 * new bundle that landed via `npm i -g` since the daemon last started. The
 * inner `uiStart` call reuses the same cwd-aware open behavior and flag
 * passthrough as a bare `indusk ui start`.
 */
export async function uiRestart(opts: UiStartOptions): Promise<void> {
	await uiStop();
	await uiStart(opts);
}

/**
 * Stop the admin-ui daemon. Reports whether it was running, the PID it
 * signaled, and whether SIGKILL was required.
 */
export async function uiStop(): Promise<void> {
	const result = await daemonStop();
	if (!result.stopped) {
		console.info("Admin UI is not running.");
		return;
	}
	if (result.usedSigkill) {
		console.warn(
			`Admin UI daemon (PID ${result.signaledPid}) did not exit within 3s; forced with SIGKILL.`,
		);
	} else {
		console.info(`Admin UI daemon (PID ${result.signaledPid}) stopped.`);
	}
}

/**
 * Report the daemon's current status plus the number of registered projects
 * (read fresh from `~/.indusk/projects.json`). The registry count is part of
 * the contract — see T3 in admin-ui-hosting/impl.md.
 */
export async function uiStatus(): Promise<void> {
	const status = await daemonStatus();
	const registry = readRegistry();
	const projectCount = registry.projects.length;
	const projectLabel = projectCount === 1 ? "project" : "projects";

	if (!status.running) {
		console.info("Admin UI: not running");
		console.info(`Registered ${projectLabel} ${projectCount} (~/.indusk/projects.json)`);
		return;
	}

	const listening = await isPortListening(status.port);
	const suffix = listening ? "" : " (port not yet listening — warming up?)";
	console.info(`Admin UI: running on port ${status.port}${suffix}`);
	console.info(`  PID: ${status.pid}`);
	console.info(`  Started: ${status.startedAt}`);
	console.info(`  Admin dir: ${status.adminDir}`);
	console.info(`Registered ${projectLabel} ${projectCount} (~/.indusk/projects.json)`);
}

/**
 * Resolve the bundled admin app directory. In the published tarball that's
 * `<indusk-mcp install root>/admin/`. In the source monorepo (where tests
 * run) the same path is used — `scripts/bundle-admin.js` populates it
 * during `pnpm build`, so the production layout is the only one we support.
 * Falling back to `apps/indusk-admin/` (the source tree) would require the
 * caller to have run `next build` there, which is never the daemon's
 * responsibility.
 */
function resolveBundledAdminDir(): string {
	const here = dirname(fileURLToPath(import.meta.url));
	// here is dist/bin/commands/ (prod) OR src/bin/commands/ (dev via tsx)
	// Either way, three levels up is the package root.
	return resolve(here, "../../../admin");
}

/**
 * Resolve the `next` CLI entrypoint relative to indusk-mcp's dependency
 * tree. Returns null if next isn't installed — the caller decides how to
 * surface that.
 */
function resolveNextBin(): string | null {
	try {
		const require = createRequire(import.meta.url);
		// `next/package.json`'s `bin.next` is `./dist/bin/next` — resolve it
		// relative to the package root.
		const pkgPath = require.resolve("next/package.json");
		return join(dirname(pkgPath), "dist/bin/next");
	} catch {
		return null;
	}
}

function openBrowser(url: string): void {
	const cmd =
		process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
	spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
}
