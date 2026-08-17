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
	/**
	 * Cleanup ritual configuration. The `/cleanup` skill reads this to decide
	 * which changed files to scrutinize at plan close. `max_file_loc` is the
	 * global line threshold; `scopes` apply tighter thresholds (and an optional
	 * `test_sibling` requirement) to files matching a glob. **The threshold is
	 * attention-focus, NOT a blocking cap** — there is no mechanical LOC gate.
	 */
	cleanup?: {
		max_file_loc?: number;
		scopes?: CleanupScope[];
	};
	/**
	 * Multi-agent bulletin configuration (`.indusk/current.md`).
	 *
	 * `stale_ttl_minutes` is the DISPLAY TTL — sections older than this are
	 * hidden from `agent list` but stay in the file. `sweep_ttl_minutes` is the
	 * DECAY TTL — sections older than this are MOVED to the archive by
	 * `indusk agent sweep` (default 7 days, deliberately much longer than the
	 * display TTL so merely-quiet sessions are never evicted).
	 */
	agents?: {
		stale_ttl_minutes?: number;
		sweep_ttl_minutes?: number;
	};
	/**
	 * Context-budget configuration (indusk-makeover). `claude_md_budget_bytes`
	 * is the hard size budget the `claude-md-budget.js` PreToolUse hook
	 * enforces on files named CLAUDE.md (default 61440 = 60 KB; warn at 90%).
	 * Raising it is a deliberate, recorded act.
	 */
	context?: {
		claude_md_budget_bytes?: number;
	};
	/**
	 * Planning-lifecycle housekeeping. `dead_draft_days` is the age threshold
	 * for `indusk plans archive-dead` — a plan whose docs are all draft-or-
	 * abandoned AND whose newest file is older than this many days is moved to
	 * `.indusk/planning/archive/` (moved, never deleted).
	 */
	planning?: {
		dead_draft_days?: number;
	};
}

/** Default sweep TTL: 7 days. Distinct from the 60-minute display TTL. */
export const DEFAULT_SWEEP_TTL_MINUTES = 7 * 24 * 60;

/** Default dead-draft age threshold for `indusk plans archive-dead`. */
export const DEFAULT_DEAD_DRAFT_DAYS = 30;

/** Read `agents.sweep_ttl_minutes` with the 7-day default. Defaults live here, in the reader. */
export function getSweepTtlMinutes(projectRoot: string): number {
	const config = readConfig(projectRoot);
	const v = config?.agents?.sweep_ttl_minutes;
	return typeof v === "number" && v > 0 ? v : DEFAULT_SWEEP_TTL_MINUTES;
}

/** Read `planning.dead_draft_days` with the 30-day default. Defaults live here, in the reader. */
export function getDeadDraftDays(projectRoot: string): number {
	const config = readConfig(projectRoot);
	const v = config?.planning?.dead_draft_days;
	return typeof v === "number" && v > 0 ? v : DEFAULT_DEAD_DRAFT_DAYS;
}

/**
 * Scaffold the decay config keys (`agents.sweep_ttl_minutes`,
 * `planning.dead_draft_days`) into `.indusk/config.json` so they're
 * discoverable. Keys on block/key PRESENCE — user-customized values are never
 * clobbered (the `ensureCleanupConfig` H8 precedent). Absence of the keys is
 * never "disabled": the readers above default regardless.
 */
export function ensureDecayConfig(projectRoot: string): "added" | "already-set" | "no-config" {
	const config = readConfig(projectRoot);
	if (!config) return "no-config";
	const hasSweep = typeof config.agents?.sweep_ttl_minutes === "number";
	const hasDeadDraft = typeof config.planning?.dead_draft_days === "number";
	if (hasSweep && hasDeadDraft) return "already-set";
	const next: InduskConfig = { ...config };
	if (!hasSweep) {
		next.agents = { ...config.agents, sweep_ttl_minutes: DEFAULT_SWEEP_TTL_MINUTES };
	}
	if (!hasDeadDraft) {
		next.planning = { ...config.planning, dead_draft_days: DEFAULT_DEAD_DRAFT_DAYS };
	}
	writeConfig(projectRoot, next);
	return "added";
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

/**
 * A per-scope cleanup rule: files matching `include` get a tighter cap and an
 * optional test-sibling requirement.
 */
export interface CleanupScope {
	include: string;
	max_file_loc?: number;
	test_sibling?: boolean;
}

/** Resolved cleanup config — global cap plus a normalized scope list. */
export interface CleanupConfig {
	max_file_loc: number;
	scopes: CleanupScope[];
}

const DEFAULT_MAX_FILE_LOC = 400;

/**
 * Reads the `cleanup` block from `.indusk/config.json`. A missing block,
 * missing file, or non-positive `max_file_loc` all fall back to the built-in
 * default (400) — the ritual is never silently disabled by config absence.
 * Malformed scope entries (no string `include`) are dropped.
 */
export function getCleanupConfig(projectRoot: string): CleanupConfig {
	const config = readConfig(projectRoot);
	const raw = config?.cleanup;
	const max =
		typeof raw?.max_file_loc === "number" && raw.max_file_loc > 0
			? raw.max_file_loc
			: DEFAULT_MAX_FILE_LOC;
	const scopes = Array.isArray(raw?.scopes)
		? raw.scopes.filter((s): s is CleanupScope => typeof s?.include === "string")
		: [];
	return { max_file_loc: max, scopes };
}

/**
 * The cap that applies to a repo-relative path: the first matching scope's cap
 * (or the global default), plus whether a test sibling is required there.
 */
export function resolveCapForPath(
	path: string,
	cfg: CleanupConfig,
): { cap: number; scope?: string; testSibling: boolean } {
	for (const s of cfg.scopes) {
		if (globToRegExp(s.include).test(path)) {
			const cap =
				typeof s.max_file_loc === "number" && s.max_file_loc > 0
					? s.max_file_loc
					: cfg.max_file_loc;
			return { cap, scope: s.include, testSibling: s.test_sibling === true };
		}
	}
	return { cap: cfg.max_file_loc, testSibling: false };
}

/**
 * Minimal glob → RegExp for scope matching. Mirrors the worktree preflight
 * `_glob_to_regex` semantics: `**` → `.*`, `*` → `[^/]*`, `?` → `.`, every other
 * regex metacharacter escaped. Anchored to a full-string match.
 */
function globToRegExp(glob: string): RegExp {
	let re = "";
	for (let i = 0; i < glob.length; i++) {
		const c = glob[i];
		if (c === "*") {
			if (glob[i + 1] === "*") {
				re += ".*";
				i++;
			} else {
				re += "[^/]*";
			}
		} else if (c === "?") {
			re += ".";
		} else if ("\\^$.|+()[]{}".includes(c)) {
			re += `\\${c}`;
		} else {
			re += c;
		}
	}
	return new RegExp(`^${re}$`);
}

/**
 * Idempotently scaffold the `cleanup` config block into an existing project.
 * Called by `indusk update` to migrate pre-cleanup-ritual projects. Returns:
 *   - `"added"`        — block was missing and has been written with defaults
 *   - `"already-set"`  — a `cleanup.max_file_loc` is already present; untouched
 *   - `"no-config"`    — the project has no `.indusk/config.json` at all
 * User content is preserved (spread over the existing config).
 */
export function ensureCleanupConfig(projectRoot: string): "added" | "already-set" | "no-config" {
	const config = readConfig(projectRoot);
	if (!config) return "no-config";
	// Key on block PRESENCE, not `max_file_loc` — a user block with `scopes` but
	// no top-level cap is valid and must never be clobbered (cleanup-ritual H8).
	const existing = (config as { cleanup?: unknown }).cleanup;
	if (existing !== null && typeof existing === "object") return "already-set";
	writeConfig(projectRoot, {
		...config,
		cleanup: { max_file_loc: DEFAULT_MAX_FILE_LOC, scopes: [] },
	} as InduskConfig);
	return "added";
}
