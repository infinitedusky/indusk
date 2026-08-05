#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { resolveProjectRoot } from "../lib/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

/**
 * Resolve the InDusk project root for commands that operate on an existing
 * project. Walks up from cwd looking for `.indusk/config.json`. If not
 * found, errors out — prevents accidental writes to the wrong `.claude/`
 * when invoked from a sub-directory like `apps/indusk-mcp/`.
 *
 * Commands that CREATE the project root (currently only `init`) use
 * `process.cwd()` directly — init is responsible for creating the marker.
 */
function rootOrExit(): string {
	const cwd = process.cwd();
	const root = resolveProjectRoot(cwd);
	if (root === null) {
		console.error(
			`Not inside an InDusk project (no .indusk/config.json found walking up from ${cwd}).\n` +
				"Run 'indusk init' here to initialize a new project, or cd to an existing one.",
		);
		process.exit(1);
	}
	if (root !== cwd) {
		console.info(`[indusk] Using project root: ${root}\n`);
	}
	return root;
}

const program = new Command();

// Brand help/usage by the name this process was invoked as (`indusk`,
// `atdawn`, `dev-system` — all bins of this package). Direct `node cli.js`
// invocations fall back to `indusk`.
const invokedName = (() => {
	const base = process.argv[1]?.split(/[\\/]/).pop() ?? "";
	return base in (pkg.bin ?? {}) ? base : "indusk";
})();

program
	.name(invokedName)
	.description("InDusk development system — skills, MCP tools, and CLI")
	.version(pkg.version);

program
	.command("init")
	.description("Initialize a project with InDusk dev system")
	.option("-f, --force", "Overwrite existing files (except CLAUDE.md and planning/)")
	.option("--local", "Local mode — no committed file changes")
	.option("--no-index", "Skip code graph indexing")
	.option(
		"--workbench",
		"Initialize as a flat single-repo workbench (Phase 6 of indusk-worktree-extension). Requires --wrapped-repo and --sibling-parent.",
	)
	.option(
		"--wrapped-repo <name>",
		"Workbench mode: the single repo name this workbench wraps (e.g., 'numero')",
	)
	.option(
		"--sibling-parent <path>",
		"Workbench mode: parent dir of the canonical clone (e.g., '~/code/sandbox'). Trunk symlink will point at <sibling-parent>/<wrapped-repo>.",
	)
	.action(async (opts) => {
		const { init } = await import("./commands/init.js");
		await init(process.cwd(), {
			force: opts.force ?? false,
			local: opts.local ?? false,
			noIndex: opts.index === false,
			workbench: opts.workbench ?? false,
			wrappedRepo: opts.wrappedRepo,
			siblingParent: opts.siblingParent,
		});
	});

program
	.command("setup <repo-path>")
	.description("Turn an already-cloned git repo into an InDusk workbench (one-shot)")
	.action(async (repoPath) => {
		const { setup } = await import("./commands/setup.js");
		await setup(repoPath);
	});

program
	.command("update")
	.description("Update skills from package without touching project content")
	.action(async () => {
		const { update } = await import("./commands/update.js");
		await update(rootOrExit());
	});

program
	.command("upgrade")
	.description("Upgrade the global indusk-mcp CLI to the latest published version")
	.option(
		"--force",
		"Install latest without comparing versions (use to recover from a stuck state)",
	)
	.action(async function (this: Command) {
		const opts = this.opts() as { force?: boolean };
		const { upgrade } = await import("./commands/upgrade.js");
		await upgrade({ force: opts.force === true });
	});

program
	.command("prune")
	.description(
		"Audit auto-loaded context bloat (CLAUDE.md sections, lessons, current.md). --dry-run is the default and only mode in this version; no destructive action.",
	)
	.option(
		"--dry-run",
		"Report only, no destructive action (default; only mode in this version)",
		true,
	)
	.option(
		"--large-section-chars <n>",
		"Flag CLAUDE.md sections larger than this many chars (default 4000)",
		(v) => Number.parseInt(v, 10),
	)
	.option(
		"--stale-lesson-days <n>",
		"Flag lessons untouched for more than this many days (default 180)",
		(v) => Number.parseInt(v, 10),
	)
	.option(
		"--stale-section-days <n>",
		"Flag current.md per-agent sections whose lastUpdated is older than this (default 7)",
		(v) => Number.parseInt(v, 10),
	)
	.action(async function (this: Command) {
		const opts = this.opts() as {
			dryRun?: boolean;
			largeSectionChars?: number;
			staleLessonDays?: number;
			staleSectionDays?: number;
		};
		const { prune } = await import("./commands/prune.js");
		await prune(rootOrExit(), {
			dryRun: opts.dryRun !== false,
			largeSectionChars: opts.largeSectionChars,
			staleLessonDays: opts.staleLessonDays,
			staleSectionDays: opts.staleSectionDays,
		});
	});

const ext = program
	.command("extensions")
	.description("Manage extensions (built-in and third-party)");

ext
	.command("list")
	.description("Show all available extensions")
	.action(async () => {
		const { extensionsList } = await import("./commands/extensions.js");
		await extensionsList(rootOrExit());
	});

ext
	.command("status")
	.description("Show enabled extensions with health")
	.action(async () => {
		const { extensionsStatus } = await import("./commands/extensions.js");
		await extensionsStatus(rootOrExit());
	});

ext
	.command("enable <names...>")
	.description("Enable extensions")
	.action(async (names: string[]) => {
		const { extensionsEnable } = await import("./commands/extensions.js");
		await extensionsEnable(rootOrExit(), names);
	});

ext
	.command("disable <names...>")
	.description("Disable extensions")
	.action(async (names: string[]) => {
		const { extensionsDisable } = await import("./commands/extensions.js");
		await extensionsDisable(rootOrExit(), names);
	});

ext
	.command("add <name>")
	.description("Add a third-party extension")
	.requiredOption("--from <source>", "Source: npm:pkg, github:user/repo, URL, or local path")
	.action(async (name: string, opts: { from: string }) => {
		const { extensionsAdd } = await import("./commands/extensions.js");
		await extensionsAdd(rootOrExit(), name, opts.from);
	});

ext
	.command("remove <names...>")
	.description("Remove extensions")
	.action(async (names: string[]) => {
		const { extensionsRemove } = await import("./commands/extensions.js");
		await extensionsRemove(rootOrExit(), names);
	});

ext
	.command("update [names...]")
	.description("Update third-party extensions from their original source")
	.action(async (names: string[]) => {
		const { extensionsUpdate } = await import("./commands/extensions.js");
		await extensionsUpdate(rootOrExit(), names);
	});

ext
	.command("suggest")
	.description("Recommend extensions based on project contents")
	.action(async () => {
		const { extensionsSuggest } = await import("./commands/extensions.js");
		await extensionsSuggest(rootOrExit());
	});

program
	.command("init-docs")
	.description(
		"Scaffold a VitePress documentation site with Mermaid, llms.txt, and FullscreenDiagram",
	)
	.action(async () => {
		const { initDocs } = await import("./commands/init-docs.js");
		await initDocs(rootOrExit());
	});

program
	.command("check-gates")
	.description(
		"Validate plan execution gates — reports incomplete verification, context, and document items",
	)
	.option("--file <path>", "Path to a specific impl.md file")
	.option("--phase <number>", "Check a specific phase number", Number.parseInt)
	.action(async (opts) => {
		const { checkGates } = await import("./commands/check-gates.js");
		await checkGates(rootOrExit(), { file: opts.file, phase: opts.phase });
	});

program
	.command("pr-clean")
	.description("Strip InDusk settings overlay before a PR")
	.action(async () => {
		const { stripOverlay } = await import("../lib/settings-overlay.js");
		stripOverlay(rootOrExit());
		console.info("Stripped InDusk overlay from .claude/settings.json");
	});

program
	.command("pr-restore")
	.description("Re-apply InDusk settings overlay after a PR")
	.action(async () => {
		const { applyOverlay } = await import("../lib/settings-overlay.js");
		applyOverlay(rootOrExit());
		console.info("Re-applied InDusk overlay to .claude/settings.json");
	});

program
	.command("install <names...>")
	.description("Install extensions (shorthand for extensions enable / add)")
	.option(
		"--from <source>",
		"Source for third-party extension (npm:pkg, github:user/repo, URL, or path)",
	)
	.action(async (names: string[], opts: { from?: string }) => {
		const root = rootOrExit();
		if (opts.from) {
			const { extensionsAdd } = await import("./commands/extensions.js");
			await extensionsAdd(root, names[0], opts.from);
		} else {
			const { extensionsEnable } = await import("./commands/extensions.js");
			await extensionsEnable(root, names);
		}
	});

const eval_ = program.command("eval").description("Context evaluation and quality scoring");

eval_
	.command("summary")
	.description("Aggregate eval scores and trends")
	.option("--mode <mode>", "Filter by mode (eval, baseline)")
	.option("--since <date>", "Show results since date")
	.option("--json", "Output as JSON")
	.action(async (opts) => {
		const { evalSummary } = await import("./commands/eval.js");
		await evalSummary(rootOrExit(), opts);
	});

eval_
	.command("findings")
	.description("List unresolved eval findings")
	.option("--all", "Show all findings including fixed/ignored")
	.action(async (opts) => {
		const { evalFindings } = await import("./commands/eval.js");
		await evalFindings(rootOrExit(), opts);
	});

eval_
	.command("fix <key>")
	.description("Mark an eval finding as fixed")
	.action(async (key: string) => {
		const { evalMark } = await import("./commands/eval.js");
		await evalMark(rootOrExit(), key, "fixed");
	});

eval_
	.command("ignore <key>")
	.description("Mark an eval finding as ignored")
	.action(async (key: string) => {
		const { evalMark } = await import("./commands/eval.js");
		await evalMark(rootOrExit(), key, "ignored");
	});

eval_
	.command("baseline")
	.description("Run baseline evaluation with vanilla agent")
	.requiredOption("--task <path>", "Path to task prompt file")
	.option("--keep", "Keep baseline worktree after eval")
	.action(async (opts) => {
		const { evalBaseline } = await import("./commands/eval.js");
		await evalBaseline(rootOrExit(), opts);
	});

program
	.command("serve")
	.description("Start the MCP server (used by Claude Code via .mcp.json)")
	.action(async () => {
		const { startServer } = await import("../server/index.js");
		await startServer();
	});

program
	.command("run <plan>")
	.description(
		"External orchestrator — run a plan through a model-agnostic gated loop (Dawn): per-phase scope, advance-on-green via a deliberate check-gates probe, goalpost guard, pause-at-human-gate.",
	)
	.option(
		"--model <name>",
		"Model/provider to drive the loop: claude | gpt | gemini | grok (alias), a bare provider name (anthropic/openai/google/xai), or a raw model id (gemini-2.5-pro, ...)",
		"claude",
	)
	.option(
		"--max-steps <n>",
		"Per-phase step budget for the one honest attempt (default 48; thinking models explore read-heavy and need more room)",
	)
	.action(async (plan: string, opts: { model?: string; maxSteps?: string }) => {
		const { run } = await import("./commands/run.js");
		const maxSteps = opts.maxSteps ? Number.parseInt(opts.maxSteps, 10) : undefined;
		await run(rootOrExit(), plan, { model: opts.model, maxSteps });
	});

program
	.command("verify <plan>")
	.description(
		"Phase-boundary verification for work Dawn did NOT execute (Cursor, a hookless session, by hand): premature checkoff, skipped test-first duty, goalpost drift, red tests, phantom work. Detects and reports — never reverts.",
	)
	.option("--phase <n>", "The phase boundary to judge (required; phases are numbered from 1)")
	.option(
		"--full-suite",
		"Run the project's whole test command instead of only the test files the trajectory references",
	)
	.action(async (plan: string, opts: { phase?: string; fullSuite?: boolean }) => {
		const { verify } = await import("./commands/verify.js");
		const phase = opts.phase === undefined ? undefined : Number.parseInt(opts.phase, 10);
		await verify(rootOrExit(), plan, { phase, fullSuite: opts.fullSuite });
	});

// Commander quirk: options declared on BOTH a parent and a subcommand cause
// the subcommand to silently receive the default for duplicated flags (the
// parent consumes the token). Declaring `--port`/`--no-open` only on the
// parent and reading them via `this.optsWithGlobals()` in each subcommand
// action is the pattern that works for both `indusk ui --port N` (bare) and
// `indusk ui start --port N` (subcommand). Verified in commander@13.
const uiCmd = program
	.command("ui")
	.description("Admin UI daemon lifecycle (start/stop/status)")
	.option("--port <port>", "Port to listen on (0 = pick free)", "3939")
	.option("--no-open", "Don't auto-open the browser when the server is ready")
	.action(async function (this: Command, opts: { port: string; open: boolean }) {
		const { uiStart } = await import("./commands/ui.js");
		await uiStart({ port: opts.port, open: opts.open });
	});

uiCmd
	.command("start")
	.description("Start the admin UI daemon")
	.action(async function (this: Command) {
		const opts = this.optsWithGlobals() as { port: string; open: boolean };
		const { uiStart } = await import("./commands/ui.js");
		await uiStart({ port: opts.port, open: opts.open });
	});

uiCmd
	.command("stop")
	.description("Stop the admin UI daemon (SIGTERM, SIGKILL fallback after 3s)")
	.action(async () => {
		const { uiStop } = await import("./commands/ui.js");
		await uiStop();
	});

uiCmd
	.command("status")
	.description("Report the daemon's state and the number of registered projects")
	.action(async () => {
		const { uiStatus } = await import("./commands/ui.js");
		await uiStatus();
	});

uiCmd
	.command("restart")
	.description(
		"Stop the admin UI daemon (if running) and start it again — picks up a new bundle from `npm i -g`",
	)
	.action(async function (this: Command) {
		const opts = this.optsWithGlobals() as { port: string; open: boolean };
		const { uiRestart } = await import("./commands/ui.js");
		await uiRestart({ port: opts.port, open: opts.open });
	});

// Telemetry daemon (Jaeger + otelcol) — same parent+subcommand + optsWithGlobals
// pattern as `indusk ui` above. Commander@13 drops duplicated options when they
// appear on both parent and child, so options live only on the parent.
const telemetryCmd = program
	.command("telemetry")
	.description("Local telemetry daemon lifecycle (start/stop/restart/status)")
	.option("--otlp-port <port>", "OTLP HTTP port for Jaeger (0 = pick free)", "4318")
	.option("--ui-port <port>", "Jaeger UI port (0 = pick free)", "16686");

telemetryCmd
	.command("start")
	.description("Start the telemetry daemon (Jaeger + otelcol)")
	.action(async function (this: Command) {
		const opts = this.optsWithGlobals() as { otlpPort: string; uiPort: string };
		const { telemetryStart } = await import("./commands/telemetry.js");
		await telemetryStart({ otlpPort: opts.otlpPort, uiPort: opts.uiPort });
	});

telemetryCmd
	.command("stop")
	.description("Stop the telemetry daemon (SIGTERM both processes, SIGKILL fallback after 3s)")
	.action(async () => {
		const { telemetryStop } = await import("./commands/telemetry.js");
		await telemetryStop();
	});

telemetryCmd
	.command("restart")
	.description("Stop + start — picks up new binaries from `npm i -g` of a newer indusk-mcp")
	.action(async function (this: Command) {
		const parent = this.parent as Command;
		const opts = parent.opts() as { otlpPort: string; uiPort: string };
		// Only forward ports when explicitly set; otherwise daemonRestart
		// inherits the previously-bound ports from the running daemon's meta,
		// which is the correct restart semantics ("same daemon, fresh processes").
		const otlpExplicit = parent.getOptionValueSource("otlpPort") === "cli";
		const uiExplicit = parent.getOptionValueSource("uiPort") === "cli";
		const { telemetryRestart } = await import("./commands/telemetry.js");
		await telemetryRestart({
			otlpPort: otlpExplicit ? opts.otlpPort : undefined,
			uiPort: uiExplicit ? opts.uiPort : undefined,
		});
	});

telemetryCmd
	.command("status")
	.description("Report the daemon's state, both ports, both PIDs, and registered-project count")
	.action(async () => {
		const { telemetryStatus } = await import("./commands/telemetry.js");
		await telemetryStatus();
	});

telemetryCmd
	.command("register <path>")
	.description(
		"(internal) Register a project path with the telemetry daemon. Called by the local-telemetry extension's on_enable hook; auto-starts the daemon if not running.",
	)
	.action(async (path: string) => {
		const { telemetryRegister } = await import("./commands/telemetry.js");
		await telemetryRegister(path);
	});

telemetryCmd
	.command("deregister <path>")
	.description(
		"(internal) Deregister a project path. Called by the on_disable hook; graceful-stops the daemon when the registry becomes empty.",
	)
	.action(async (path: string) => {
		const { telemetryDeregister } = await import("./commands/telemetry.js");
		await telemetryDeregister(path);
	});

telemetryCmd
	.command("tail")
	.description(
		"Print recent log records (from otelcol's file sink). Same filters as the MCP `tail_logs` tool.",
	)
	.option("--service <name>", "filter by service.name")
	.option("--level <level>", "filter by severity (error/warn/info/debug/any)", "any")
	.option("--since <minutes>", "how far back to look, in minutes", "5")
	.option("--limit <n>", "max records to print", "50")
	.action(async (opts: { service?: string; level: string; since: string; limit: string }) => {
		const { telemetryTail } = await import("./commands/telemetry.js");
		const level = ["error", "warn", "info", "debug", "any"].includes(opts.level)
			? (opts.level as "error" | "warn" | "info" | "debug" | "any")
			: "any";
		await telemetryTail({
			service: opts.service,
			level,
			sinceMinutes: opts.since,
			limit: opts.limit,
		});
	});

telemetryCmd
	.command("trace <id>")
	.description("Print the full span tree for a trace ID (via Jaeger's REST query API).")
	.action(async (id: string) => {
		const { telemetryTrace } = await import("./commands/telemetry.js");
		await telemetryTrace(id);
	});

telemetryCmd
	.command("services")
	.description("List services the daemon has seen, one per line.")
	.action(async () => {
		const { telemetryServices } = await import("./commands/telemetry.js");
		await telemetryServices();
	});

telemetryCmd
	.command("reset")
	.description(
		"Stop the daemon, clear in-memory trace storage + log sink, and restart. Human-only — not exposed as an MCP tool.",
	)
	.action(async function (this: Command) {
		const opts = this.optsWithGlobals() as { otlpPort: string; uiPort: string };
		const { telemetryReset } = await import("./commands/telemetry.js");
		await telemetryReset({ otlpPort: opts.otlpPort, uiPort: opts.uiPort });
	});

// ---- worktree extension lifecycle ----
// Worktree extension lifecycle. Phase 4 shipped the internal _on-enable
// hook; Phase 6 adds the user-facing create / refresh / list / preflight
// subcommands that wrap the bash scripts in apps/indusk-mcp/extensions/
// worktree/scripts/.

const worktreeCmd = program
	.command("worktree")
	.description("Worktree extension lifecycle (create/refresh/list/preflight)");

worktreeCmd
	.command("_on-enable", { hidden: true })
	.description(
		"(internal) Scaffold the worktree extension into the workbench. Invoked by the extension's on_enable hook.",
	)
	.action(async () => {
		const { worktreeOnEnable } = await import("./commands/worktree.js");
		worktreeOnEnable();
	});

worktreeCmd
	.command("create <slug> [base-branch]")
	.description(
		"Create a worktree at <workbench>/<slug>, branched off [base-branch] (default: config's base_branch or main)",
	)
	.action(async (slug: string, baseBranch?: string) => {
		const { worktreeCreate } = await import("./commands/worktree.js");
		worktreeCreate(slug, baseBranch);
	});

worktreeCmd
	.command("refresh <slug>")
	.description(
		"Re-apply config to an existing worktree (copy_files, append_files, apply_commits); clears skip-worktree for removed apply_commits entries",
	)
	.action(async (slug: string) => {
		const { worktreeRefresh } = await import("./commands/worktree.js");
		worktreeRefresh(slug);
	});

worktreeCmd
	.command("list")
	.description(
		"Show the wrapped repo, trunk symlink status, per-repo config status, and current worktrees",
	)
	.action(async () => {
		const { worktreeList } = await import("./commands/worktree.js");
		worktreeList(rootOrExit());
	});

worktreeCmd
	.command("preflight <slug> [base-branch]")
	.description(
		"Run preflight commands scoped to files changed vs [base-branch] (default: origin/main); exits non-zero on first failure",
	)
	.action(async (slug: string, baseBranch?: string) => {
		const { worktreePreflight } = await import("./commands/worktree.js");
		worktreePreflight(slug, baseBranch);
	});

// ---- doppler extension: env management ----
const dopplerCmd = program.command("doppler").description("Doppler env management (env-pull)");

dopplerCmd
	.command("env-pull <profile>")
	.description(
		"Materialize apps/<app>/.env.<profile> from Doppler (profile: local | staging | production), using the InDusk-level service token",
	)
	.action(async (profile: string) => {
		const { dopplerEnvPull } = await import("./commands/doppler.js");
		dopplerEnvPull(rootOrExit(), profile);
	});

const agentCmd = program
	.command("agent")
	.description("Multi-agent presence bulletin (register / done / list / prune)");

agentCmd
	.command("register")
	.description("Register the current Claude Code session as a working agent on this project")
	.requiredOption("--task <description>", "One-line description of what you're working on")
	.option("--branch <branch>", "Override detected git branch")
	.option("--worktree <path>", "Override detected worktree path (defaults to cwd)")
	.action(async (opts: { task: string; branch?: string; worktree?: string }) => {
		const { agentRegister } = await import("./commands/agent.js");
		agentRegister(rootOrExit(), opts);
	});

agentCmd
	.command("done")
	.description("Remove the current session's presence file (or one named via --session-id)")
	.option("--session-id <id>", "Session ID to mark done (defaults to current session)")
	.action(async (opts: { sessionId?: string }) => {
		const { agentDone } = await import("./commands/agent.js");
		agentDone(rootOrExit(), opts);
	});

agentCmd
	.command("list")
	.description(
		"Print the bulletin of currently-registered agents (filtered by agents.stale_ttl_minutes)",
	)
	.action(async () => {
		const { agentList } = await import("./commands/agent.js");
		agentList(rootOrExit());
	});

agentCmd
	.command("prune")
	.description("Remove every stale presence file unconditionally")
	.action(async () => {
		const { agentPrune } = await import("./commands/agent.js");
		agentPrune(rootOrExit());
	});

const syncCmd = program
	.command("sync")
	.description("Hub push/pull rule distribution (promote / pull) — InDusk is the hub");

syncCmd
	.command("promote <lesson>")
	.description(
		"Push a proven-general project lesson into the machine-global hub channel ($INDUSK_HOME/hub/lessons/)",
	)
	.action(async (lesson: string) => {
		const { syncPromote } = await import("./commands/sync.js");
		syncPromote(rootOrExit(), lesson);
	});

syncCmd
	.command("pull")
	.description(
		"Merge the hub channel + bundled community lessons into this project's .claude/lessons/ — additive-only, local always wins",
	)
	.action(async () => {
		const { syncPull } = await import("./commands/sync.js");
		syncPull(rootOrExit());
	});

const contextCmd = program
	.command("context")
	.description("Project-context housekeeping (check-pointers)");

contextCmd
	.command("check-pointers")
	.description(
		"Verify every path-shaped reference in CLAUDE.md resolves on disk — a dead pointer under the rule+pointer regime is a lost rule body",
	)
	.action(async () => {
		const { contextCheckPointers } = await import("./commands/context.js");
		contextCheckPointers(rootOrExit());
	});

const plansCmd = program
	.command("plans")
	.description("Planning-lifecycle housekeeping (archive-dead)");

plansCmd
	.command("archive-dead")
	.description(
		"Move dead-draft plans (all docs draft/abandoned, older than planning.dead_draft_days) to .indusk/planning/archive/ — moved, never deleted",
	)
	.option("--dry-run", "Report candidates without moving anything")
	.action(async (opts: { dryRun?: boolean }) => {
		const { plansArchiveDead } = await import("./commands/plans.js");
		plansArchiveDead(rootOrExit(), opts);
	});

agentCmd
	.command("sweep")
	.description(
		"Archive sections older than agents.sweep_ttl_minutes (default 7d) to .indusk/archive/current-md-archive.md — moved, never deleted",
	)
	.option("--dry-run", "Report what would be swept without mutating anything")
	.action(async (opts: { dryRun?: boolean }) => {
		const { agentSweep } = await import("./commands/agent.js");
		agentSweep(rootOrExit(), opts);
	});

program.parse();
