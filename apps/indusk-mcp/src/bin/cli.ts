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

program
	.name("dev-system")
	.description("InDusk development system — skills, MCP tools, and CLI")
	.version(pkg.version);

program
	.command("init")
	.description("Initialize a project with InDusk dev system")
	.option("-f, --force", "Overwrite existing files (except CLAUDE.md and planning/)")
	.option("--local", "Local mode — no committed file changes")
	.option("--no-index", "Skip code graph indexing")
	.action(async (opts) => {
		const { init } = await import("./commands/init.js");
		await init(process.cwd(), {
			force: opts.force ?? false,
			local: opts.local ?? false,
			noIndex: opts.index === false,
		});
	});

program
	.command("update")
	.description("Update skills from package without touching project content")
	.action(async () => {
		const { update } = await import("./commands/update.js");
		await update(rootOrExit());
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

const infra = program
	.command("infra")
	.description("Manage the indusk-infra container (FalkorDB + Graphiti)");

infra
	.command("start")
	.description("Start the infrastructure container (creates if needed)")
	.action(async () => {
		const { infraStart } = await import("./commands/infra.js");
		await infraStart();
	});

infra
	.command("stop")
	.description("Stop the infrastructure container (preserves data)")
	.action(async () => {
		const { infraStop } = await import("./commands/infra.js");
		await infraStop();
	});

infra
	.command("status")
	.description("Show infrastructure container health and configuration")
	.action(async () => {
		const { infraStatus } = await import("./commands/infra.js");
		await infraStatus();
	});

const graph = program
	.command("graph")
	.description("Manage the semantic graph (sync, rebuild, status)");

graph
	.command("sync")
	.description("Sync CGC structural data into the semantic graph")
	.action(async () => {
		const { basename } = await import("node:path");
		const { CgcAdapter } = await import("../lib/semantic-graph/adapters/cgc.js");
		const { LogWriter } = await import("../lib/semantic-graph/log-writer.js");
		const { getLogPath } = await import("../lib/semantic-graph/paths.js");
		const { SemanticGraphClient } = await import("../lib/semantic-graph/runtime-client.js");
		const { runSync } = await import("../lib/semantic-graph/sync-engine.js");

		const projectRoot = rootOrExit();
		const projectName = basename(projectRoot);
		const adapter = new CgcAdapter();
		const logWriter = new LogWriter(getLogPath(projectRoot));
		const client = new SemanticGraphClient(projectName);

		await client.ensureConnection();
		console.info("Syncing semantic graph...");
		const result = await runSync(adapter, projectRoot, logWriter, client);
		await client.close();

		console.info(
			`Created: ${result.created}, Moved: ${result.moved}, Tombstoned: ${result.tombstoned}, Edges: ${result.edges_attached}, Unchanged: ${result.unchanged}`,
		);
		console.info(`Duration: ${result.duration_ms}ms`);
	});

graph
	.command("rebuild")
	.description("Clear and rebuild the semantic graph runtime from the event log")
	.action(async () => {
		const { basename } = await import("node:path");
		const { getLogPath } = await import("../lib/semantic-graph/paths.js");
		const { replay } = await import("../lib/semantic-graph/replay.js");
		const { SemanticGraphClient } = await import("../lib/semantic-graph/runtime-client.js");

		const projectRoot = rootOrExit();
		const projectName = basename(projectRoot);
		const logPath = getLogPath(projectRoot);
		const client = new SemanticGraphClient(projectName);

		await client.ensureConnection();
		console.info("Clearing runtime...");
		await client.clearGraph();
		await client.close();

		const freshClient = new SemanticGraphClient(projectName);
		await freshClient.ensureConnection();
		console.info("Replaying log...");
		const result = await replay(logPath, freshClient);
		await freshClient.close();

		console.info(
			`Total: ${result.total}, Applied: ${result.applied}, Skipped: ${result.skipped}, Errors: ${result.errors}`,
		);
	});

graph
	.command("status")
	.description("Show semantic graph status")
	.action(async () => {
		const { basename } = await import("node:path");
		const { existsSync, statSync } = await import("node:fs");
		const { getLogPath } = await import("../lib/semantic-graph/paths.js");
		const { readAllEvents } = await import("../lib/semantic-graph/log-reader.js");
		const { SemanticGraphClient } = await import("../lib/semantic-graph/runtime-client.js");

		const projectRoot = rootOrExit();
		const projectName = basename(projectRoot);
		const logPath = getLogPath(projectRoot);

		console.info(`Project: ${projectName}`);
		console.info(`Log: ${logPath}`);

		if (existsSync(logPath)) {
			const stat = statSync(logPath);
			const events = await readAllEvents(logPath);
			console.info(`  Events: ${events.length}`);
			console.info(`  Size: ${(stat.size / 1024).toFixed(1)}KB`);

			const lastSync = [...events].reverse().find((e) => e.type === "sync.completed");
			if (lastSync) {
				console.info(`  Last sync: ${lastSync.ts}`);
			}
		} else {
			console.info("  (no log file — run 'indusk graph sync' first)");
		}

		try {
			const client = new SemanticGraphClient(projectName);
			await client.ensureConnection();
			const anchors = await client.countAnchors();
			const edges = await client.countEdges();
			await client.close();
			console.info(`Runtime: ${anchors} anchors, ${edges} edges`);
		} catch {
			console.info("Runtime: FalkorDB not available");
		}
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
	.command("beam <file>")
	.description("Get file-specific context from all sources")
	.option("--trace", "Show query trace")
	.option("--json", "Output as JSON")
	.action(async (file: string, opts: { trace?: boolean; json?: boolean }) => {
		const { runBeam } = await import("../lib/beam/runner.js");
		const { formatBeamMarkdown, formatBeamTrace } = await import("../lib/beam/format.js");

		const result = await runBeam({
			projectRoot: rootOrExit(),
			targetPath: file,
			trace: opts.trace ?? false,
		});

		if (opts.json) {
			console.info(JSON.stringify(result, null, 2));
		} else if (opts.trace) {
			console.info(formatBeamTrace(result));
		} else {
			console.info(formatBeamMarkdown(result));
		}
	});

program
	.command("serve")
	.description("Start the MCP server (used by Claude Code via .mcp.json)")
	.action(async () => {
		const { startServer } = await import("../server/index.js");
		await startServer();
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
	.description("Stop the admin UI daemon (if running) and start it again — picks up a new bundle from `npm i -g`")
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
	.option(
		"--otlp-port <port>",
		"OTLP HTTP port for Jaeger (0 = pick free)",
		"4318",
	)
	.option(
		"--ui-port <port>",
		"Jaeger UI port (0 = pick free)",
		"16686",
	);

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
		const opts = this.optsWithGlobals() as { otlpPort: string; uiPort: string };
		const { telemetryRestart } = await import("./commands/telemetry.js");
		await telemetryRestart({ otlpPort: opts.otlpPort, uiPort: opts.uiPort });
	});

telemetryCmd
	.command("status")
	.description("Report the daemon's state, both ports, both PIDs, and registered-project count")
	.action(async () => {
		const { telemetryStatus } = await import("./commands/telemetry.js");
		await telemetryStatus();
	});

program.parse();
