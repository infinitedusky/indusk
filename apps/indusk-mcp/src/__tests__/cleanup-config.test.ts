import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCleanupConfig, resolveCapForPath } from "../lib/config.js";

/**
 * Cleanup-ritual Phase 1 — the `cleanup` config block reader.
 *
 * T7 — getCleanupConfig returns the built-in default threshold when no
 *      `cleanup` block is present (the ritual is never silently disabled by
 *      config absence).
 *
 * Plus supporting coverage for resolveCapForPath scope resolution, which the
 * Phase 2 oversized lib (T6) exercises end-to-end via a git fixture.
 */

function tmpProject(config: Record<string, unknown> | null): string {
	const dir = mkdtempSync(join(tmpdir(), "cleanup-config-"));
	mkdirSync(join(dir, ".indusk"), { recursive: true });
	if (config) {
		writeFileSync(join(dir, ".indusk", "config.json"), JSON.stringify(config));
	}
	return dir;
}

describe("cleanup-ritual T7: config reader defaults when no cleanup block", () => {
	it("getCleanupConfig returns the built-in default cap when the block is absent", () => {
		const dir = tmpProject({ mode: "full" });
		expect(getCleanupConfig(dir).max_file_loc).toBe(400);
		expect(getCleanupConfig(dir).scopes).toEqual([]);
	});

	it("getCleanupConfig returns the built-in default cap when config.json is missing entirely", () => {
		const dir = tmpProject(null);
		expect(getCleanupConfig(dir).max_file_loc).toBe(400);
	});
});

describe("cleanup-ritual: resolveCapForPath scope resolution (supports T6)", () => {
	const withScope = () =>
		getCleanupConfig(
			tmpProject({
				cleanup: {
					max_file_loc: 400,
					scopes: [
						{ include: "packages/*/src/components/**", max_file_loc: 200, test_sibling: true },
					],
				},
			}),
		);

	it("a path inside a tighter scope resolves to the scope cap", () => {
		const cfg = withScope();
		const resolved = resolveCapForPath("packages/game-ui/src/components/Chip.tsx", cfg);
		expect(resolved.cap).toBe(200);
		expect(resolved.testSibling).toBe(true);
	});

	it("a path outside every scope resolves to the global default cap", () => {
		const cfg = withScope();
		const resolved = resolveCapForPath("apps/web/lib/util.ts", cfg);
		expect(resolved.cap).toBe(400);
		expect(resolved.testSibling).toBe(false);
	});
});
