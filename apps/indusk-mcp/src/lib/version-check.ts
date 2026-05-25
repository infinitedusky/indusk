/**
 * Cached version-availability check against the public npm registry.
 *
 * Rationale: `indusk update` used to shell out to `npm view` and trigger an
 * in-process self-install on every invocation, which (a) loops infinitely
 * when the install lands somewhere other than the on-PATH binary, and
 * (b) couples project-state work to machine-state work. The new model is
 * notify-only: a quiet TTL-cached fetch surfaces a one-line "upgrade
 * available" notice, and the user explicitly runs `indusk upgrade` to
 * install. See `bin/commands/upgrade.ts` for the install side.
 *
 * Network failure is silent (returns the cached value if present, else
 * null). Cache lives at `${INDUSK_HOME}/version-check.json` with a 6h TTL,
 * tunable per call. Set `INDUSK_SKIP_UPDATE_CHECK=1` to suppress.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const PKG_NAME = "@infinitedusky/indusk-mcp";
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const DEFAULT_TIMEOUT_MS = 5_000;

export interface VersionCheckResult {
	/** Latest version per npm, or null when unknown (no cache and network failed). */
	latestVersion: string | null;
	/** Whether the value came from the on-disk cache (true) or a fresh fetch (false). */
	fromCache: boolean;
	/** When the value was originally fetched. ISO-8601. */
	checkedAt: string | null;
}

export interface VersionCheckOptions {
	/** Override the cache path (testing). Default: `${INDUSK_HOME}/version-check.json`. */
	cachePath?: string;
	/** TTL in ms. Default: 6h. */
	ttlMs?: number;
	/** Fetch timeout in ms. Default: 5s. */
	timeoutMs?: number;
	/** Inject a fetch implementation for tests. Default: global fetch. */
	fetchImpl?: typeof fetch;
	/** Bypass the cache and force a fresh network call. */
	bypassCache?: boolean;
}

interface CacheShape {
	checkedAt: string;
	latestVersion: string;
}

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function defaultCachePath(): string {
	return join(induskHome(), "version-check.json");
}

function readCache(path: string): CacheShape | null {
	if (!existsSync(path)) return null;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<CacheShape>;
		if (typeof parsed.checkedAt !== "string" || typeof parsed.latestVersion !== "string") {
			return null;
		}
		return { checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion };
	} catch {
		return null;
	}
}

function writeCache(path: string, cache: CacheShape): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`);
}

function isFresh(cache: CacheShape, ttlMs: number, now: number = Date.now()): boolean {
	const checkedAtMs = Date.parse(cache.checkedAt);
	if (!Number.isFinite(checkedAtMs)) return false;
	return now - checkedAtMs < ttlMs;
}

/**
 * Resolve the latest published version. Two paths:
 *
 *  - Test path: when `fetchImpl` is provided, hits the public npm registry
 *    directly via the injected fetch. Lets the test suite avoid spawning
 *    npm subprocesses.
 *  - Production path: shells out to `npm view <pkg> version --json`, which
 *    honors scope-specific registry config in the user's `~/.npmrc`
 *    (e.g., `@infinitedusky:registry=https://npm.pkg.github.com`) AND the
 *    auth tokens registered there. The previous direct-fetch always hit
 *    registry.npmjs.org, which silently returned stale data for packages
 *    published to GitHub Packages or a private registry.
 *
 * Returns null on any error — callers fall back to cache.
 */
async function fetchLatestFromNpm(
	timeoutMs: number,
	fetchImpl: typeof fetch | undefined,
): Promise<string | null> {
	if (fetchImpl !== undefined) {
		const url = `https://registry.npmjs.org/${encodeURIComponent(PKG_NAME)}/latest`;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const res = await fetchImpl(url, {
				headers: { Accept: "application/json" },
				signal: controller.signal,
			});
			if (!res.ok) return null;
			const body = (await res.json()) as { version?: unknown };
			return typeof body.version === "string" ? body.version : null;
		} catch {
			return null;
		} finally {
			clearTimeout(timer);
		}
	}

	try {
		const out = execFileSync("npm", ["view", PKG_NAME, "version", "--json"], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: timeoutMs,
		}).trim();
		// `npm view <pkg> <field> --json` returns the value as JSON.
		// A single field is a quoted string like `"1.28.21"`. Parse for
		// robustness in case npm changes the shape (e.g., returns an
		// array of versions).
		const parsed = JSON.parse(out);
		return typeof parsed === "string" ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Resolve the latest version. Read-through cache: if the on-disk cache is
 * fresh, return it without touching the network; otherwise fetch, persist,
 * and return. On network failure with no cache, returns `latestVersion:
 * null`. Honors `INDUSK_SKIP_UPDATE_CHECK=1` (returns null without any
 * disk or network access).
 */
export async function checkLatestVersion(
	options: VersionCheckOptions = {},
): Promise<VersionCheckResult> {
	// INDUSK_SKIP_UPDATE_CHECK is the new name; INDUSK_SKIP_SELF_UPDATE is
	// the legacy alias used by ~7 existing tests (set to suppress network
	// access during `indusk update` runs against a tmp project). Honor both
	// so test scaffolding doesn't need to change.
	if (process.env.INDUSK_SKIP_UPDATE_CHECK === "1" || process.env.INDUSK_SKIP_SELF_UPDATE === "1") {
		return { latestVersion: null, fromCache: false, checkedAt: null };
	}
	const cachePath = options.cachePath ?? defaultCachePath();
	const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	// Undefined in production (triggers the `npm view` path); set by tests.
	const fetchImpl = options.fetchImpl;
	const bypass = options.bypassCache === true;

	const cached = readCache(cachePath);
	if (!bypass && cached && isFresh(cached, ttlMs)) {
		return {
			latestVersion: cached.latestVersion,
			fromCache: true,
			checkedAt: cached.checkedAt,
		};
	}

	const fresh = await fetchLatestFromNpm(timeoutMs, fetchImpl);
	if (fresh === null) {
		// Network failed — fall back to whatever's cached (even if stale),
		// so the notice is "best known" rather than absent.
		if (cached) {
			return {
				latestVersion: cached.latestVersion,
				fromCache: true,
				checkedAt: cached.checkedAt,
			};
		}
		return { latestVersion: null, fromCache: false, checkedAt: null };
	}

	const checkedAt = new Date().toISOString();
	try {
		writeCache(cachePath, { checkedAt, latestVersion: fresh });
	} catch {
		// Cache write failed (permission, full disk) — return the fresh
		// value anyway; next invocation just won't have the cache hit.
	}
	return { latestVersion: fresh, fromCache: false, checkedAt };
}

/**
 * Pure comparator: returns true when `latest` is a different, presumably
 * newer version than `current`. Intentionally string-equality — pre-1.0
 * semver gymnastics aren't worth it for the notify path; if npm publishes
 * a different string than what's installed, we surface it. The user's
 * `upgrade` command does the actual decision.
 */
export function hasNewerVersion(current: string, latest: string | null): boolean {
	return latest !== null && latest.length > 0 && latest !== current;
}
