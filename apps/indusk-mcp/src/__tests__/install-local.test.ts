import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * promise: landing-installs-after-a-dependency-change
 *
 * A3 — landing's install step syncs the checkout's dependencies to the
 * lockfile, refusing one that does not match, before it builds anything. A
 * merge that changed the lockfile otherwise builds against a stale
 * node_modules (component-content's landing failed this way).
 */

const REPO_ROOT = new URL("../../../..", import.meta.url).pathname;

function readJson(rel: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(REPO_ROOT, rel), "utf-8"));
}

describe("landing's install step (landing-installs-after-a-dependency-change)", () => {
	it("A3: syncs dependencies to the lockfile before it builds", () => {
		const scripts = (readJson("package.json").scripts ?? {}) as Record<string, string>;
		const steps = (scripts["install:local"] ?? "").split("&&").map((s) => s.trim());
		expect(steps[0]).toBe("pnpm install --frozen-lockfile");
		const build = steps.findIndex((s) => s.includes("prepublishOnly"));
		expect(build, "the build step is still part of install:local").toBeGreaterThan(0);
	});

	it("A3: landing still runs install:local", () => {
		const config = readJson(".indusk/config.json") as {
			workflow?: { steps?: { land?: { install?: string } } };
		};
		expect(config.workflow?.steps?.land?.install).toBe("pnpm install:local");
	});
});
