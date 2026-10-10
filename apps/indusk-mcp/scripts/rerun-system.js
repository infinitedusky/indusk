#!/usr/bin/env node
/**
 * rerun-system.js <repo-relative test file…> — run again only the system-tier
 * files a release's slow run saw fail (`workflow.steps.release.slow_tests.rerun`,
 * release-records-its-failures D5).
 *
 * `pnpm -w test:system -- <files>` cannot do this: the root script is an
 * `sh -c '…'` that never reads its arguments, so every file would run again.
 * Here each file goes to its own package (`apps/<dir>/…`), is made relative to
 * that package, and runs through that package's system config and the daemon
 * guard, without the package build the first run already did. A package with no
 * failing file is not run, so its report is left as the first run wrote it.
 * Exits non-zero if any rerun does.
 */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const guard = join(here, "with-daemon-guard.js");

const byApp = new Map();
for (const file of process.argv.slice(2)) {
	const m = /^apps\/([^/]+)\/(.+)$/.exec(file.replaceAll("\\", "/"));
	if (!m) {
		console.error(`rerun-system: ${file} is not under apps/<dir>/ — skipped`);
		continue;
	}
	byApp.set(m[1], [...(byApp.get(m[1]) ?? []), m[2]]);
}

let status = 0;
for (const [app, files] of byApp) {
	const cwd = join(repoRoot, "apps", app);
	const run = spawnSync(
		"node",
		[guard, "pnpm", "exec", "vitest", "run", "--config", "vitest.system.config.ts", ...files],
		{ cwd, stdio: "inherit" },
	);
	if (run.status !== 0) status = run.status ?? 1;
}
process.exit(status);
