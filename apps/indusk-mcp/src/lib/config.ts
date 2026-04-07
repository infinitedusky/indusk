import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface VerifyToolConfig {
	tool: string;
	config: string;
}

export interface InduskConfig {
	mode: "full" | "local";
	verify: {
		linter?: VerifyToolConfig;
		testRunner?: VerifyToolConfig;
		typeCheck?: string;
	};
	detected: {
		otel?: boolean;
		testRunner?: string;
		linter?: string;
	};
	graphiti?: {
		/**
		 * Group id used for project-specific Graphiti episodes. Defaults to the
		 * project directory basename. Override here if the directory name differs
		 * from the desired group id (e.g. shared monorepo, renamed project).
		 */
		groupId?: string;
	};
	otel?: {
		/**
		 * Project's relationship to OpenTelemetry. Controls whether the OTel gate
		 * fires when the planner writes impl phases and when the validate-impl-structure
		 * / check-gates hooks evaluate them.
		 *
		 * - `service`: produces telemetry I want to collect (default behavior; gate fires)
		 * - `library`: ships to other people, never produces telemetry (gate silent)
		 * - `tool`: short-lived script, telemetry overhead exceeds value (gate silent)
		 * - `none`: explicit opt-out for legacy/prototype/internal experiments (gate silent)
		 *
		 * **If unset, behaves as `service`** (gate fires). This preserves backwards
		 * compatibility — existing projects without the field continue to get the OTel
		 * gate enforced. Opt-out is explicit; opt-in is implicit.
		 */
		role?: "service" | "library" | "tool" | "none";
	};
}

const CONFIG_PATH = ".indusk/config.json";

export function getConfigPath(projectRoot: string): string {
	return join(projectRoot, CONFIG_PATH);
}

export function readConfig(projectRoot: string): InduskConfig | null {
	const configPath = getConfigPath(projectRoot);
	if (!existsSync(configPath)) return null;
	return JSON.parse(readFileSync(configPath, "utf-8"));
}

export function writeConfig(projectRoot: string, config: InduskConfig): void {
	const configPath = getConfigPath(projectRoot);
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
}

export function getPlanningDir(projectRoot: string): string {
	const newPath = join(projectRoot, ".indusk/planning");
	const legacyPath = join(projectRoot, "planning");

	// Prefer .indusk/planning, fall back to legacy planning/ for migration
	if (existsSync(newPath)) return newPath;
	if (existsSync(legacyPath)) return legacyPath;

	// Default to new path (will be created by init)
	return newPath;
}

/**
 * Get the Graphiti group id for project-specific episodes.
 *
 * Resolution order:
 *   1. .indusk/config.json `graphiti.groupId` if set
 *   2. Project directory basename
 *
 * Use `[getProjectGroupId(root), "shared"]` as the default group_ids list when
 * searching Graphiti — this gives both project-scoped and cross-project knowledge.
 */
export function getProjectGroupId(projectRoot: string): string {
	const config = readConfig(projectRoot);
	if (config?.graphiti?.groupId) return config.graphiti.groupId;
	return basename(projectRoot);
}

/**
 * Whether the OTel gate should fire for this project.
 *
 * Returns `true` if `.indusk/config.json` is missing, missing `otel.role`, or
 * has `otel.role: "service"`. Returns `false` only when the project explicitly
 * opts out via `otel.role: "library" | "tool" | "none"`.
 *
 * Used by:
 *   - planner skill (whether to write `#### Phase N OTel` sections into impl.md)
 *   - validate-impl-structure hook (whether to require an OTel section at write time)
 *   - check-gates hook (whether to block phase advancement on missing OTel)
 *
 * Backwards compatible: projects without the new field behave exactly as before.
 */
export function shouldEmitOtelGate(projectRoot: string): boolean {
	const config = readConfig(projectRoot);
	const role = config?.otel?.role;
	return role === undefined || role === "service";
}
