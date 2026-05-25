import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkLatestVersion, hasNewerVersion } from "./version-check.js";

let tmpDir: string;
let cachePath: string;
const originalSkip = process.env.INDUSK_SKIP_UPDATE_CHECK;
const originalSkipLegacy = process.env.INDUSK_SKIP_SELF_UPDATE;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "version-check-"));
	cachePath = join(tmpDir, "version-check.json");
	delete process.env.INDUSK_SKIP_UPDATE_CHECK;
	delete process.env.INDUSK_SKIP_SELF_UPDATE;
});

afterEach(() => {
	if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
	if (originalSkip === undefined) delete process.env.INDUSK_SKIP_UPDATE_CHECK;
	else process.env.INDUSK_SKIP_UPDATE_CHECK = originalSkip;
	if (originalSkipLegacy === undefined) delete process.env.INDUSK_SKIP_SELF_UPDATE;
	else process.env.INDUSK_SKIP_SELF_UPDATE = originalSkipLegacy;
});

function fakeFetch(version: string, ok = true): typeof fetch {
	return vi.fn(async () => ({
		ok,
		json: async () => ({ version }),
	})) as unknown as typeof fetch;
}

function brokenFetch(): typeof fetch {
	return vi.fn(async () => {
		throw new Error("ENETUNREACH");
	}) as unknown as typeof fetch;
}

describe("checkLatestVersion", () => {
	it("fetches and caches when no cache exists", async () => {
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBe("1.99.0");
		expect(result.fromCache).toBe(false);
		expect(existsSync(cachePath)).toBe(true);
		const cached = JSON.parse(readFileSync(cachePath, "utf-8"));
		expect(cached.latestVersion).toBe("1.99.0");
		expect(typeof cached.checkedAt).toBe("string");
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("serves from cache when within TTL", async () => {
		writeFileSync(
			cachePath,
			JSON.stringify({
				checkedAt: new Date().toISOString(),
				latestVersion: "1.50.0",
			}),
		);
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl, ttlMs: 60_000 });
		expect(result.latestVersion).toBe("1.50.0");
		expect(result.fromCache).toBe(true);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("re-fetches when cache is older than TTL", async () => {
		const oldDate = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(); // 10h ago
		writeFileSync(cachePath, JSON.stringify({ checkedAt: oldDate, latestVersion: "1.50.0" }));
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({
			cachePath,
			fetchImpl,
			ttlMs: 6 * 60 * 60 * 1000, // 6h
		});
		expect(result.latestVersion).toBe("1.99.0");
		expect(result.fromCache).toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("falls back to stale cache when network fails", async () => {
		const oldDate = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString();
		writeFileSync(cachePath, JSON.stringify({ checkedAt: oldDate, latestVersion: "1.50.0" }));
		const result = await checkLatestVersion({
			cachePath,
			fetchImpl: brokenFetch(),
			ttlMs: 6 * 60 * 60 * 1000,
		});
		expect(result.latestVersion).toBe("1.50.0");
		expect(result.fromCache).toBe(true);
	});

	it("returns null when network fails and no cache exists", async () => {
		const result = await checkLatestVersion({
			cachePath,
			fetchImpl: brokenFetch(),
		});
		expect(result.latestVersion).toBeNull();
		expect(result.fromCache).toBe(false);
	});

	it("bypasses cache when bypassCache is true", async () => {
		writeFileSync(
			cachePath,
			JSON.stringify({
				checkedAt: new Date().toISOString(),
				latestVersion: "1.50.0",
			}),
		);
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({
			cachePath,
			fetchImpl,
			bypassCache: true,
		});
		expect(result.latestVersion).toBe("1.99.0");
		expect(result.fromCache).toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("short-circuits when INDUSK_SKIP_UPDATE_CHECK=1", async () => {
		process.env.INDUSK_SKIP_UPDATE_CHECK = "1";
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
		// Should NOT have created a cache file
		expect(existsSync(cachePath)).toBe(false);
	});

	it("short-circuits when legacy INDUSK_SKIP_SELF_UPDATE=1 is set (backward-compat)", async () => {
		process.env.INDUSK_SKIP_SELF_UPDATE = "1";
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("treats a non-200 response as a fetch failure", async () => {
		const fetchImpl = fakeFetch("1.99.0", false);
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBeNull();
	});

	it("ignores a malformed cache file (missing fields)", async () => {
		writeFileSync(cachePath, JSON.stringify({ stale: true }));
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBe("1.99.0");
		expect(result.fromCache).toBe(false);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("ignores a cache file with unparseable JSON", async () => {
		writeFileSync(cachePath, "{ not json");
		const fetchImpl = fakeFetch("1.99.0");
		const result = await checkLatestVersion({ cachePath, fetchImpl });
		expect(result.latestVersion).toBe("1.99.0");
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});
});

describe("hasNewerVersion", () => {
	it("reports newer when versions differ", () => {
		expect(hasNewerVersion("1.28.16", "1.28.18")).toBe(true);
	});

	it("reports not-newer when versions match", () => {
		expect(hasNewerVersion("1.28.18", "1.28.18")).toBe(false);
	});

	it("reports not-newer for null or empty latest", () => {
		expect(hasNewerVersion("1.28.18", null)).toBe(false);
		expect(hasNewerVersion("1.28.18", "")).toBe(false);
	});
});
