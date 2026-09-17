import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.js";
import { checkLatestVersion } from "./version-check.js";

/**
 * The three-way version state, read fresh on every call.
 *
 * On 2026-09-17 an agent told the operator that 1.50.0 still needed publishing,
 * an hour after the operator had run `pnpm release`, `indusk upgrade` and
 * `indusk update`. None of the three left a mark anywhere an agent reads, so
 * the agent repeated an hour-old fact as the current state. This module is the
 * fix on the system side: `check_health` reports it on every call, so every
 * `/catchup` states it, and the three commands each leave a mark —
 *
 *   - `indusk update` writes `indusk.version` + `indusk.updated_at` to the
 *     project's `.indusk/config.json` (`projectUpdatedTo` below);
 *   - `indusk upgrade` replaces the installed package, which IS the mark
 *     (`installed` is this package's own version);
 *   - `pnpm release` appends the publish to `.indusk/current.md`'s shared
 *     region (`scripts/record-release.js`), and `published` is read from the
 *     registry itself, so no local marker can lie about it.
 *
 * The agent-side rule is the other half: never state a publish, upgrade or
 * update fact without reading this in the same turn.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
/** This package's root — `src/lib/` in source, `dist/lib/` when built; both are two levels down. */
const PACKAGE_ROOT = join(__dirname, "../..");

/**
 * What reaches the tarball, as source paths relative to the monorepo root.
 * A deliberate mirror of `PACKAGED_PATHS` in `scripts/release-guard.sh` — bash
 * cannot import this, so `version-state.test.ts` pins the two lists equal.
 */
export const PACKAGED_PATHS = [
	"apps/indusk-mcp/src",
	"apps/indusk-mcp/skills",
	"apps/indusk-mcp/templates",
	"apps/indusk-mcp/hooks",
	"apps/indusk-mcp/lessons",
	"apps/indusk-mcp/extensions",
	"apps/indusk-mcp/package.json",
	"apps/indusk-admin",
] as const;

export interface RepoVersionState {
	/** `apps/indusk-mcp/package.json` version in the working tree. */
	version: string;
	/** The `chore(release): <version>` commit, or null when none names this version. */
	releaseCommit: string | null;
	/** Commits after the release commit that touch packaged paths — unreleased work. */
	packagedCommitsSince: number;
	/** The packaged files those commits changed (first ten). */
	packagedFilesSince: string[];
}

export interface VersionState {
	/** The package running this code — the installed CLI / MCP server. */
	installed: string;
	/** Latest on the registry, or null when unknown (offline, no cache). */
	published: string | null;
	publishedFromCache: boolean;
	/** The version `indusk update` last applied to this project, if it recorded one. */
	projectUpdatedTo: string | null;
	projectUpdatedAt: string | null;
	/** Present only when `projectRoot` is the indusk-mcp monorepo itself. */
	repo: RepoVersionState | null;
}

export interface VersionStateOptions {
	/** Inject the registry lookup (tests). */
	checkLatest?: () => Promise<{ latestVersion: string | null; fromCache: boolean }>;
	/** Inject the installed version (tests). */
	installed?: string;
}

function readPackageVersion(pkgJsonPath: string): string {
	return (JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as { version: string }).version;
}

function git(root: string, args: string[]): string | null {
	try {
		return execFileSync("git", args, {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

/** The monorepo's own release position, or null when `projectRoot` is any other project. */
export function readRepoVersionState(projectRoot: string): RepoVersionState | null {
	const pkgJson = join(projectRoot, "apps", "indusk-mcp", "package.json");
	if (!existsSync(pkgJson) || !existsSync(join(projectRoot, ".git"))) return null;
	const version = readPackageVersion(pkgJson);
	const releaseCommit = git(projectRoot, [
		"log",
		"--format=%H",
		`--grep=^chore(release): ${version}\\b`,
		"-1",
	]);
	if (!releaseCommit) {
		return { version, releaseCommit: null, packagedCommitsSince: 0, packagedFilesSince: [] };
	}
	const files = (
		git(projectRoot, ["diff", "--name-only", `${releaseCommit}..HEAD`, "--", ...PACKAGED_PATHS]) ??
		""
	)
		.split("\n")
		.filter(Boolean);
	const commits = files.length
		? Number(
				git(projectRoot, [
					"rev-list",
					"--count",
					`${releaseCommit}..HEAD`,
					"--",
					...PACKAGED_PATHS,
				]) ?? 0,
			)
		: 0;
	return {
		version,
		releaseCommit: releaseCommit.slice(0, 8),
		packagedCommitsSince: commits,
		packagedFilesSince: files.slice(0, 10),
	};
}

export async function readVersionState(
	projectRoot: string,
	opts: VersionStateOptions = {},
): Promise<VersionState> {
	const installed = opts.installed ?? readPackageVersion(join(PACKAGE_ROOT, "package.json"));
	const latest = await (opts.checkLatest ?? (() => checkLatestVersion()))();
	const recorded = readConfig(projectRoot)?.indusk;
	return {
		installed,
		published: latest.latestVersion,
		publishedFromCache: latest.fromCache,
		projectUpdatedTo: recorded?.version ?? null,
		projectUpdatedAt: recorded?.updated_at ?? null,
		repo: readRepoVersionState(projectRoot),
	};
}

/** One line, the way `check_health` and `/catchup` print it. */
export function formatVersionState(s: VersionState): string {
	const parts = [
		`installed ${s.installed}`,
		s.published === null
			? "published unknown (registry unreachable, no cache)"
			: `published ${s.published}${s.publishedFromCache ? " (cached)" : ""}`,
		s.projectUpdatedTo === null
			? "project never recorded an update — run `indusk update`"
			: `project updated to ${s.projectUpdatedTo}${s.projectUpdatedAt ? ` on ${s.projectUpdatedAt.slice(0, 10)}` : ""}`,
	];
	if (s.repo) {
		parts.push(
			s.repo.releaseCommit === null
				? `repo ${s.repo.version} with no release commit`
				: `release commit ${s.repo.releaseCommit} for ${s.repo.version}, ${s.repo.packagedCommitsSince} packaged commit(s) since`,
		);
	}
	return parts.join(" · ");
}

/**
 * What, if anything, is degraded. A project updated by a different version
 * than the one running has stale skills and hooks — that is a fault, not a
 * notice. An available upgrade or unreleased packaged work is information.
 */
export function versionStateProblem(s: VersionState): string | null {
	if (s.projectUpdatedTo !== null && s.projectUpdatedTo !== s.installed) {
		return `this project was last updated by ${s.projectUpdatedTo} but ${s.installed} is running — run \`indusk update\``;
	}
	return null;
}
