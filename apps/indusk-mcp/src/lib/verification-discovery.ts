import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";

export interface DiscoveredCheck {
	name: string;
	command: string;
	source: "package.json" | "config-file";
}

const SCRIPT_PATTERNS: Record<string, string> = {
	typecheck: "typecheck",
	"type-check": "type-check",
	lint: "lint",
	test: "test",
	build: "build",
	check: "check",
	"check:fix": "check:fix",
};

export function discoverVerificationCommands(projectRoot: string): DiscoveredCheck[] {
	const checks: DiscoveredCheck[] = [];

	// 1. Read package.json scripts
	const pkgPath = join(projectRoot, "package.json");
	if (existsSync(pkgPath)) {
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		const scripts = pkg.scripts ?? {};

		for (const [pattern, name] of Object.entries(SCRIPT_PATTERNS)) {
			if (scripts[pattern]) {
				const runner = existsSync(join(projectRoot, "pnpm-lock.yaml"))
					? "pnpm"
					: existsSync(join(projectRoot, "yarn.lock"))
						? "yarn"
						: "npm";
				checks.push({
					name,
					command: `${runner} run ${pattern}`,
					source: "package.json",
				});
			}
		}

		// Check for tsc script variants
		if (!checks.some((c) => c.name === "typecheck") && scripts.tsc) {
			checks.push({ name: "typecheck", command: "npm run tsc", source: "package.json" });
		}
	}

	// 2. Detect tool configs
	if (existsSync(join(projectRoot, "biome.json")) && !checks.some((c) => c.name === "check")) {
		checks.push({ name: "biome", command: "npx biome check", source: "config-file" });
	}

	if (
		existsSync(join(projectRoot, "tsconfig.json")) &&
		!checks.some((c) => c.name === "typecheck")
	) {
		checks.push({ name: "typecheck", command: "npx tsc --noEmit", source: "config-file" });
	}

	const vitestConfigs = globSync("vitest.config.*", { cwd: projectRoot });
	if (vitestConfigs.length > 0 && !checks.some((c) => c.name === "test")) {
		checks.push({ name: "test", command: "npx vitest run", source: "config-file" });
	}

	const jestConfigs = globSync("jest.config.*", { cwd: projectRoot });
	if (jestConfigs.length > 0 && !checks.some((c) => c.name === "test")) {
		checks.push({ name: "test", command: "npx jest", source: "config-file" });
	}

	return checks;
}
