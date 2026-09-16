import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveCheckRoots } from "./health.js";

/**
 * What tooling a project uses — linter, test runner, OTel, TypeScript — read
 * from the files that declare it.
 *
 * Detection runs over `resolveCheckRoots(projectRoot)`: the project itself in
 * a flat repo, the DECLARED repos in a workbench. It used to run once against
 * the project root, which in a workbench is the wrapper — a directory holding
 * `.indusk/` and no code — so no runner was ever detected there and every
 * split verify reported its rows unverified under a clean verdict
 * (dawn-workbench-execution A16). The health checks made the same move for
 * the same reason: the wrapper holds no code, so anything asked of it about
 * code answers "none".
 *
 * The first root that detects a field wins that field; a polyglot workbench
 * with one vitest repo and one Python repo records vitest, which is the
 * honest answer for the repo that has tests verify can run.
 */
export interface DetectedTooling {
	linter?: string;
	testRunner?: string;
	otel?: boolean;
	typeCheck?: boolean;
}

function detectToolingIn(projectRoot: string): DetectedTooling {
	const detected: DetectedTooling = {};

	// Detect linter
	if (existsSync(join(projectRoot, "biome.json")) || existsSync(join(projectRoot, "biome.jsonc"))) {
		detected.linter = "biome";
	} else if (
		existsSync(join(projectRoot, ".eslintrc.js")) ||
		existsSync(join(projectRoot, ".eslintrc.json")) ||
		existsSync(join(projectRoot, ".eslintrc.cjs")) ||
		existsSync(join(projectRoot, "eslint.config.js")) ||
		existsSync(join(projectRoot, "eslint.config.mjs")) ||
		existsSync(join(projectRoot, "eslint.config.ts"))
	) {
		detected.linter = "eslint";
	}

	// Detect test runner
	if (
		existsSync(join(projectRoot, "vitest.config.ts")) ||
		existsSync(join(projectRoot, "vitest.config.js"))
	) {
		detected.testRunner = "vitest";
	} else if (
		existsSync(join(projectRoot, "jest.config.js")) ||
		existsSync(join(projectRoot, "jest.config.ts"))
	) {
		detected.testRunner = "jest";
	}

	// Detect OTel
	if (
		existsSync(join(projectRoot, "instrumentation.ts")) ||
		existsSync(join(projectRoot, "src/instrumentation.ts")) ||
		existsSync(join(projectRoot, "instrumentation.py"))
	) {
		detected.otel = true;
	}

	// Detect TypeScript
	if (existsSync(join(projectRoot, "tsconfig.json"))) {
		detected.typeCheck = true;
	}

	return detected;
}

export function detectTooling(projectRoot: string): DetectedTooling {
	const merged: DetectedTooling = {};
	for (const root of resolveCheckRoots(projectRoot)) {
		const found = detectToolingIn(root);
		for (const key of ["linter", "testRunner", "otel", "typeCheck"] as const) {
			if (merged[key] === undefined && found[key] !== undefined) {
				(merged as Record<string, unknown>)[key] = found[key];
			}
		}
	}
	return merged;
}
