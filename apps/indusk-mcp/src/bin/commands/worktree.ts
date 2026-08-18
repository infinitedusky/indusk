import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isWorkbench, readWorkbenchRepos } from "../../lib/worktree/repos.js";
import { validateWorktreeConfig } from "../../lib/worktree/validate-config.js";
import { provisionWorktreeEnv } from "./doppler.js";

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
	const pkgRoot = indusKMcpPackageRoot();
	const script = resolve(pkgRoot, "extensions/worktree/scripts/setup-worktree.sh");
	if (!existsSync(script)) {
		console.error(`Error: setup-worktree.sh not found at ${script}`);
		process.exit(1);
	}
	const r = spawnSync("bash", [script, ...(baseBranch ? [slug, baseBranch] : [slug])], {
		cwd: process.cwd(),
		stdio: "inherit",
	});
	const code = r.status ?? 1;
	// On success: (1) auto-provision env via the doppler extension if configured,
	// then (2) run the config's post_create commands (install/build/etc.) in the
	// new worktree — so `worktree create` yields a runnable worktree in one shot.
	if (code === 0) {
		try {
			const workbenchRoot = resolveWorkbenchRoot(process.cwd());
			if (workbenchRoot) {
				const worktreeDir = join(workbenchRoot, slug);
				if (provisionWorktreeEnv(workbenchRoot, worktreeDir)) {
					console.info(`  doppler: auto-provisioned env for ${slug}`);
				}
				for (const cmd of readPostCreate(workbenchRoot)) {
					console.info(`  post_create: ${cmd}`);
					const pc = spawnSync(cmd, { cwd: worktreeDir, stdio: "inherit", shell: true });
					if (pc.status !== 0) {
						console.error(
							`  post_create failed (exit ${pc.status ?? "?"}): ${cmd}\n` +
								`  worktree created but not fully provisioned — fix, then re-run in ${worktreeDir}`,
						);
						break;
					}
				}
			}
		} catch (e) {
			console.error(`  worktree provisioning failed — ${(e as Error).message}`);
		}
	}
	process.exit(code);
}

/** Read `post_create` commands from the workbench's worktree config — run in each new worktree after create. */
function readPostCreate(workbenchRoot: string): string[] {
	const repo = readWorkbenchRepos(workbenchRoot)[0]?.name;
	if (!repo) return [];
	const p = join(workbenchRoot, ".indusk", "worktree-configs", `${repo}.json`);
	if (!existsSync(p)) return [];
	try {
		const cfg = JSON.parse(readFileSync(p, "utf-8")) as { post_create?: unknown };
		return Array.isArray(cfg.post_create)
			? cfg.post_create.filter((c): c is string => typeof c === "string")
			: [];
	} catch {
		return [];
	}
}

/** Walk up from `start` to the nearest workbench root (`.indusk/config.json` with worktree.shape === "workbench"). */
function resolveWorkbenchRoot(start: string): string | null {
	let dir = resolve(start);
	for (let i = 0; i < 40; i++) {
		if (isWorkbench(dir)) return dir;
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

export function worktreeRefresh(slug: string): never {
	runWorktreeScript("refresh-worktree", [slug]);
}

export function worktreePreflight(slug: string, baseBranch?: string): never {
	runWorktreeScript("preflight", baseBranch ? [slug, baseBranch] : [slug]);
}

// ---- list (TS-implemented; uses the Phase 2 validator) ----------------------

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
		// D7: the workbench-root internal-docs directory the versioned-workbench
		// shape adopts. Absent from this set it renders as a worktree, which is
		// how the avoca POC's `docs/` looked before anyone noticed.
		"docs",
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
/**
 * Which declared repo does this worktree belong to?
 *
 * Asked of git rather than inferred from the slug: `--git-common-dir` resolves
 * to the OWNING repo's `.git`, so the answer survives any naming convention a
 * developer invents. A name-prefix heuristic would attribute `alpha-feature`
 * to `alpha` by luck and `experiment` to nothing at all — and a wrong
 * attribution reads exactly like a right one.
 *
 * Null means "could not tell", which renders as unattributed rather than being
 * quietly assigned to the first repo.
 */
function worktreeOwner(worktreePath: string, repoPaths: Map<string, string>): string | null {
	const r = spawnSync(
		"git",
		["-C", worktreePath, "rev-parse", "--path-format=absolute", "--git-common-dir"],
		{
			encoding: "utf-8",
		},
	);
	if (r.status !== 0 || !r.stdout) return null;
	const commonDir = r.stdout.trim();
	for (const [name, repoPath] of repoPaths) {
		try {
			if (realpathSync(commonDir).startsWith(realpathSync(repoPath))) return name;
		} catch {
			// unresolvable path — treat as no match rather than guessing
		}
	}
	return null;
}

/** Trunk symlink status for one declared repo. */
function trunkStatusFor(trunkPath: string): string {
	if (!existsSync(trunkPath)) {
		return "missing — run `indusk workbench restore` to materialize it";
	}
	try {
		const st = lstatSync(trunkPath);
		if (!st.isSymbolicLink()) return "directory (not a symlink — unusual for a workbench trunk)";
		const target = readlinkSync(trunkPath);
		return existsSync(trunkPath)
			? `→ ${target} (resolves)`
			: `symlink broken (target ${target} not found)`;
	} catch (err) {
		return `error: ${(err as Error).message}`;
	}
}

/** Per-repo worktree config badge. */
function configStatusFor(projectRoot: string, repo: string): { path: string; status: string } {
	const configPath = join(projectRoot, ".indusk", "worktree-configs", `${repo}.json`);
	if (!existsSync(configPath)) return { path: configPath, status: "(config missing)" };
	try {
		const result = validateWorktreeConfig(JSON.parse(readFileSync(configPath, "utf-8")));
		if (result.valid) return { path: configPath, status: "(config valid)" };
		const first = result.errors[0];
		return {
			path: configPath,
			status: first ? `(config invalid: ${first.field} — ${first.message})` : "(config invalid)",
		};
	} catch (err) {
		return {
			path: configPath,
			status: `(config invalid: parse error — ${(err as Error).message})`,
		};
	}
}

/**
 * `indusk worktree list` — the workbench's current state, one block per
 * declared repo.
 *
 * N repos rather than one wrapped repo: each declared repo gets its own trunk
 * line, its own config badge, and its own worktrees. Attribution matters more
 * than layout here — a reader has to be able to tell "beta has no worktrees"
 * from "beta's worktrees are listed under alpha".
 */
export function worktreeList(projectRoot: string): void {
	const repos = readWorkbenchRepos(projectRoot);

	if (!isWorkbench(projectRoot) || repos.length === 0) {
		console.error(
			'Error: this project is not a workbench (set worktree.shape="workbench" and worktree.repos[] in .indusk/config.json, or run `indusk init --workbench`).',
		);
		process.exit(1);
	}

	const repoPaths = new Map(repos.map((r) => [r.name, join(projectRoot, r.name)]));
	const declaredNames = new Set(repos.map((r) => r.name));
	const slugs = listSubdirs(projectRoot).filter((name) => !declaredNames.has(name));

	const byRepo = new Map<string, string[]>(repos.map((r) => [r.name, []]));
	const unattributed: string[] = [];
	for (const slug of slugs) {
		const owner = worktreeOwner(join(projectRoot, slug), repoPaths);
		if (owner) byRepo.get(owner)?.push(slug);
		else unattributed.push(slug);
	}

	console.info(`Workbench:    ${projectRoot}`);
	console.info(`Repos (${repos.length}): ${repos.map((r) => r.name).join(", ")}`);

	for (const repo of repos) {
		const cfg = configStatusFor(projectRoot, repo.name);
		const mine = byRepo.get(repo.name) ?? [];
		console.info("");
		console.info(`${repo.name}`);
		console.info(`  Trunk:      ${repo.name} ${trunkStatusFor(join(projectRoot, repo.name))}`);
		console.info(
			`  Remote:     ${repo.remote ?? "(none declared — `workbench restore` cannot clone it)"}`,
		);
		console.info(`  Config:     ${cfg.path} ${cfg.status}`);
		if (mine.length === 0) {
			console.info(
				`  Worktrees:  (none) — \`indusk worktree create ${repo.name} <slug>\` to add one`,
			);
		} else {
			console.info(`  Worktrees (${mine.length}):`);
			for (const slug of mine) console.info(`    ${slug}`);
		}
	}

	if (unattributed.length > 0) {
		console.info("");
		console.info(`Unattributed (${unattributed.length}) — not a worktree of any declared repo:`);
		for (const slug of unattributed) console.info(`  ${slug}`);
	}
}
