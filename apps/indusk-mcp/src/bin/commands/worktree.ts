import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `indusk worktree` subcommands.
 *
 * Phase 4 ships ONE internal entry point — `_on-enable` — used by the
 * worktree extension's manifest `on_enable` hook. The user-facing
 * commands (`create`, `refresh`, `list`, `preflight`) ship in Phase 6.
 *
 * The `_` prefix marks the command as internal — exposed but not
 * advertised in `indusk worktree --help` output.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resolve a path inside the indusk-mcp package, regardless of whether
 * we're running from a global install (`~/.pnpm/global/.../indusk-mcp/dist/`)
 * or from the dev monorepo (`apps/indusk-mcp/dist/`). Walks up from the
 * compiled command location until it finds a sibling `package.json`
 * whose `name` matches `@infinitedusky/indusk-mcp`.
 */
function indusKMcpPackageRoot(): string {
	let cur = __dirname;
	for (let i = 0; i < 8; i++) {
		const pkgJson = join(cur, "package.json");
		if (existsSync(pkgJson)) {
			try {
				const parsed = JSON.parse(readFileSync(pkgJson, "utf-8")) as {
					name?: string;
				};
				if (parsed.name === "@infinitedusky/indusk-mcp") return cur;
			} catch {
				// fall through
			}
		}
		const parent = dirname(cur);
		if (parent === cur) break;
		cur = parent;
	}
	throw new Error(`could not resolve @infinitedusky/indusk-mcp package root from ${__dirname}`);
}

/**
 * Internal — invoked by the worktree extension's `on_enable` hook.
 * Shells out to `extensions/worktree/hooks/on_enable.sh` with cwd
 * preserved (so the bash script's `_resolve_workbench_root` walks up
 * from the user's invocation dir).
 */
export function worktreeOnEnable(): void {
	const pkgRoot = indusKMcpPackageRoot();
	const script = resolve(pkgRoot, "extensions/worktree/hooks/on_enable.sh");
	if (!existsSync(script)) {
		console.error(`Error: worktree on_enable hook not found at ${script}`);
		process.exit(1);
	}
	const r = spawnSync("bash", [script], {
		cwd: process.cwd(),
		stdio: "inherit",
	});
	process.exit(r.status ?? 1);
}
