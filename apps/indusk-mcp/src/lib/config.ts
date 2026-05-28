import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

/**
 * Resolve the InDusk project root by walking up from the given directory
 * until `.indusk/config.json` is found. Returns the directory containing
 * `.indusk/config.json`, or `null` if none is found up to the filesystem
 * root.
 *
 * `.indusk/config.json` is the authoritative "this is an InDusk project"
 * marker — created by `indusk init`, never by sub-apps that happen to
 * have their own `.claude/` scaffolding. Walking up to find it prevents
 * bugs like `indusk update` syncing to the wrong `.claude/` when the user
 * runs it from a sub-directory (e.g. `apps/indusk-mcp/`).
 *
 * For `indusk init` itself, use the raw cwd — init creates the marker, so
 * walk-up would either find nothing or (worse) match an ancestor project
 * the user doesn't intend to re-init.
 */
export function resolveProjectRoot(startDir: string): string | null {
	let dir = startDir;
	for (let i = 0; i < 20; i++) {
		if (existsSync(join(dir, ".indusk/config.json"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) return null;
		dir = parent;
	}
	return null;
}

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
	/**
	 * Source-control system the project uses. Set once at init by `detectScm()`
	 * and read at runtime via `getScm(projectRoot)`. Don't re-detect per call —
	 * the config field is the runtime source of truth.
	 *
	 * `jj` is the historical default — InDusk shipped with jj as the only SCM
	 * substrate. `git` mode adds plain-git support; the semantic graph is jj-only
	 * in v1 and graceful-degrades on git mode (sync no-ops with a clear message).
	 *
	 * **If unset on a pre-existing project, callers default to `jj`** (preserves
	 * pre-1.28.x behavior). New projects scaffolded by `init` always have the
	 * field populated; `update` migrates pre-1.28.x projects on the next run.
	 */
	scm?: "jj" | "git";
	/**
	 * Eval-agent configuration. Most of this is read directly via JSON
	 * traversal in `lib/eval/otel.ts`; the schema here is documentary.
	 */
	eval?: {
		enabled?: boolean;
		endpoint?: string | null;
		otel?: {
			enabled?: boolean;
			dataset?: string;
		};
		/**
		 * Model the eval agent uses for fresh first-call evals. Accepts any
		 * value Claude Code's `--model` flag accepts: shortcuts (`opus`,
		 * `sonnet`, `haiku`) or full IDs (`claude-sonnet-4-6`).
		 *
		 * **Default: `"sonnet"`** — chosen because resume calls already drop
		 * to Sonnet on Claude Code's machine default, so making first-call
		 * also Sonnet matches the actual behavior most users experience and
		 * cuts catchup cost ~5× ($4–$7 → $0.80–$1.50 per fresh call).
		 *
		 * Set to `"opus"` to force Opus on fresh first-call. Note: subsequent
		 * resume calls do NOT re-pass `--model` (Claude Code's session model
		 * inheritance is opaque from our side), so Opus on fresh-call may not
		 * mean Opus on resume. Verify via `~/.claude/projects/<pkg>/<sessionId>.jsonl`.
		 */
		model?: string;
	};
	/**
	 * Extensions the project has explicitly opted OUT of, even if they're
	 * marked `required: true` in the built-in manifest. Escape hatch for
	 * security/perf-constrained projects that can't run a localhost daemon
	 * or similar. The required-by-default resolver (in
	 * `autoEnableExtensions`) honors this list.
	 *
	 * Add via hand-edit to `.indusk/config.json`; there's no CLI affordance
	 * for this because opting out of a required extension is a deliberate,
	 * rare act.
	 */
	disabled_extensions?: string[];
}

/**
 * True if the given extension is listed in `.indusk/config.json`'s
 * `disabled_extensions` array. Single source of truth for the required-
 * by-default escape hatch.
 */
export function isExtensionExplicitlyDisabled(projectRoot: string, name: string): boolean {
	const config = readConfig(projectRoot);
	const list = config?.disabled_extensions;
	if (!Array.isArray(list)) return false;
	return list.includes(name);
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
 * Sanitize a string into a valid Graphiti group id.
 *
 * Graphiti uses RediSearch under the hood, which treats `-` as a token separator.
 * A query like `chitin-sportsbook` parses as "find chitin, exclude sportsbook" and
 * fails with `Syntax error at offset N near chitin`. Anything that isn't
 * `[A-Za-z0-9_]` gets replaced with `_`. Multiple separators collapse to one.
 *
 * Examples:
 *   "chitin-sportsbook" → "chitin_sportsbook"
 *   "my.cool.project"   → "my_cool_project"
 *   "@scope/pkg"        → "scope_pkg"
 *   "indusk_already_ok" → "indusk_already_ok" (no change)
 */
export function sanitizeGroupId(raw: string): string {
	return raw.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Get the Graphiti group id for project-specific episodes.
 *
 * Resolution order:
 *   1. .indusk/config.json `graphiti.groupId` if set (used as-is, not sanitized —
 *      explicit overrides are trusted; if you set a hyphenated id, that's on you)
 *   2. Sanitized project directory basename (`-` → `_`, etc., for RediSearch safety)
 *
 * Use `[getProjectGroupId(root), "shared"]` as the default group_ids list when
 * searching Graphiti — this gives both project-scoped and cross-project knowledge.
 */
export function getProjectGroupId(projectRoot: string): string {
	const config = readConfig(projectRoot);
	if (config?.graphiti?.groupId) return config.graphiti.groupId;
	return sanitizeGroupId(basename(projectRoot));
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

const DEFAULT_EVAL_MODEL = "sonnet";

/**
 * Model arg the eval agent passes to `claude --print --model <arg>` on fresh
 * first-call evals. Reads `eval.model` from `.indusk/config.json`; defaults to
 * `"sonnet"` when unset.
 *
 * Why default to sonnet: empirical pricing on resume calls (which don't pass
 * `--model` and inherit Claude Code's machine default) shows ~5× cheaper than
 * Opus. Defaulting fresh-call to Sonnet matches that behavior and saves the
 * catchup-cost spike. Set `eval.model: "opus"` to opt back into Opus.
 *
 * Returns the raw string — pass directly to `--model`. Accepts any value
 * Claude Code's `--model` accepts (`opus`, `sonnet`, `haiku`, full IDs).
 */
export function getEvalModel(projectRoot: string): string {
	const config = readConfig(projectRoot);
	const model = config?.eval?.model;
	if (typeof model === "string" && model.length > 0) return model;
	return DEFAULT_EVAL_MODEL;
}
