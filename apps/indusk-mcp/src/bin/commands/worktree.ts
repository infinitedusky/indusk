import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWorktreeConfig } from "../../lib/worktree/validate-config.js";

/**
 * `indusk worktree` subcommands.
 *
 *   _on-enable  internal — invoked by the extension's on_enable hook
 *   create      create a worktree (wraps setup-worktree.sh)
 *   refresh     re-apply config to an existing worktree
 *   list        show wrapped repo + worktrees + config status
 *   preflight   run scoped pre-push checks against a worktree's diff
 *
 * The `_` prefix marks a command as internal — exposed but not
 * advertised in `indusk worktree --help` output.
 *
 * create / refresh / preflight are thin wrappers around their bash
 * counterparts (setup-worktree.sh, refresh-worktree.sh, preflight.sh).
 * list is implemented in TS so it can use the Phase 2 config validator
 * and produce structured table output for T11's status badges.
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

// ---- thin script wrappers ---------------------------------------------------

/**
 * Shell out to a script in the extension's `scripts/` dir. Uses the
 * package-root walker so it works for both global installs and dev.
 * Exits with the script's exit code.
 */
function runWorktreeScript(scriptName: string, args: string[]): never {
	const pkgRoot = indusKMcpPackageRoot();
	const script = resolve(pkgRoot, `extensions/worktree/scripts/${scriptName}.sh`);
	if (!existsSync(script)) {
		console.error(`Error: ${scriptName}.sh not found at ${script}`);
		process.exit(1);
	}
	const r = spawnSync("bash", [script, ...args], {
		cwd: process.cwd(),
		stdio: "inherit",
	});
	process.exit(r.status ?? 1);
}

export function worktreeCreate(slug: string, baseBranch?: string): never {
	runWorktreeScript("setup-worktree", baseBranch ? [slug, baseBranch] : [slug]);
}

export function worktreeRefresh(slug: string): never {
	runWorktreeScript("refresh-worktree", [slug]);
}

export function worktreePreflight(slug: string, baseBranch?: string): never {
	runWorktreeScript("preflight", baseBranch ? [slug, baseBranch] : [slug]);
}

// ---- list (TS-implemented; uses the Phase 2 validator) ----------------------

interface WorkbenchConfig {
	worktree?: {
		shape?: string;
		wrapped_repo?: string;
		sibling_parent?: string;
	};
}

function readWorkbenchConfig(workbenchRoot: string): WorkbenchConfig | null {
	const cfg = join(workbenchRoot, ".indusk", "config.json");
	if (!existsSync(cfg)) return null;
	try {
		return JSON.parse(readFileSync(cfg, "utf-8")) as WorkbenchConfig;
	} catch {
		return null;
	}
}

function listSubdirs(workbenchRoot: string): string[] {
	const reserved = new Set([
		".indusk",
		".claude",
		".vscode",
		".cursor",
		"node_modules",
		"dist",
		"build",
		".git",
		".next",
		"scripts",
		"env",
	]);
	const entries: string[] = [];
	for (const name of readdirSync(workbenchRoot)) {
		if (reserved.has(name)) continue;
		const full = join(workbenchRoot, name);
		try {
			const st = lstatSync(full);
			if (st.isDirectory() || st.isSymbolicLink()) entries.push(name);
		} catch {
			// fall through
		}
	}
	return entries.sort();
}

/**
 * `indusk worktree list` — print the workbench's current state:
 *   - wrapped repo + trunk symlink path + resolves status
 *   - worktrees as siblings of the trunk
 *   - worktree config status badge: (config valid) / (config missing) /
 *     (config invalid: <reason>) / (no worktrees)
 */
export function worktreeList(projectRoot: string): void {
	const config = readWorkbenchConfig(projectRoot);
	const wrappedRepo = config?.worktree?.wrapped_repo;
	const shape = config?.worktree?.shape;

	if (shape !== "workbench" || !wrappedRepo) {
		console.error(
			'Error: this project is not a workbench (set worktree.shape="workbench" and worktree.wrapped_repo in .indusk/config.json, or run `indusk init --workbench`).',
		);
		process.exit(1);
	}

	// Trunk: symlink at workbench/<wrapped_repo>
	const trunkPath = join(projectRoot, wrappedRepo);
	let trunkStatus = "";
	let trunkTarget = "";
	if (!existsSync(trunkPath)) {
		trunkStatus = "missing — run `indusk init --workbench` to create it";
	} else {
		try {
			const st = lstatSync(trunkPath);
			if (st.isSymbolicLink()) {
				trunkTarget = readlinkSync(trunkPath);
				// Resolve to verify the target exists.
				if (!existsSync(trunkPath)) {
					trunkStatus = `symlink broken (target ${trunkTarget} not found)`;
				} else {
					trunkStatus = `→ ${trunkTarget} (resolves)`;
				}
			} else {
				trunkStatus = "directory (not a symlink — unusual for a workbench trunk)";
			}
		} catch (err) {
			trunkStatus = `error: ${(err as Error).message}`;
		}
	}

	// Per-repo config: .indusk/worktree-configs/<wrapped_repo>.json
	const configPath = join(projectRoot, ".indusk", "worktree-configs", `${wrappedRepo}.json`);
	let configStatus = "";
	if (!existsSync(configPath)) {
		configStatus = "(config missing)";
	} else {
		try {
			const raw = JSON.parse(readFileSync(configPath, "utf-8"));
			const result = validateWorktreeConfig(raw);
			if (result.valid) {
				configStatus = "(config valid)";
			} else {
				const firstErr = result.errors[0];
				configStatus = firstErr
					? `(config invalid: ${firstErr.field} — ${firstErr.message})`
					: "(config invalid)";
			}
		} catch (err) {
			configStatus = `(config invalid: parse error — ${(err as Error).message})`;
		}
	}

	// Worktrees: subdirs at workbench root excluding the trunk + reserved.
	const allSubdirs = listSubdirs(projectRoot);
	const worktreeSlugs = allSubdirs.filter((name) => name !== wrappedRepo);

	console.info(`Workbench:    ${projectRoot}`);
	console.info(`Wrapped repo: ${wrappedRepo}`);
	console.info(`Trunk:        ${wrappedRepo} ${trunkStatus}`);
	console.info(`Config:       ${configPath} ${configStatus}`);
	console.info("");
	if (worktreeSlugs.length === 0) {
		console.info("Worktrees:    (no worktrees) — `indusk worktree create <slug>` to add one");
	} else {
		console.info(`Worktrees (${worktreeSlugs.length}):`);
		for (const slug of worktreeSlugs) {
			console.info(`  ${slug}`);
		}
	}
}
