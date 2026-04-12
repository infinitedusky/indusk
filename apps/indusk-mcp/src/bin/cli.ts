#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "../../package.json"), "utf-8"));

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
		await update(process.cwd());
	});

const ext = program
	.command("extensions")
	.description("Manage extensions (built-in and third-party)");

ext
	.command("list")
	.description("Show all available extensions")
	.action(async () => {
		const { extensionsList } = await import("./commands/extensions.js");
		await extensionsList(process.cwd());
	});

ext
	.command("status")
	.description("Show enabled extensions with health")
	.action(async () => {
		const { extensionsStatus } = await import("./commands/extensions.js");
		await extensionsStatus(process.cwd());
	});

ext
	.command("enable <names...>")
	.description("Enable extensions")
	.action(async (names: string[]) => {
		const { extensionsEnable } = await import("./commands/extensions.js");
		await extensionsEnable(process.cwd(), names);
	});

ext
	.command("disable <names...>")
	.description("Disable extensions")
	.action(async (names: string[]) => {
		const { extensionsDisable } = await import("./commands/extensions.js");
		await extensionsDisable(process.cwd(), names);
	});

ext
	.command("add <name>")
	.description("Add a third-party extension")
	.requiredOption("--from <source>", "Source: npm:pkg, github:user/repo, URL, or local path")
	.action(async (name: string, opts: { from: string }) => {
		const { extensionsAdd } = await import("./commands/extensions.js");
		await extensionsAdd(process.cwd(), name, opts.from);
	});

ext
	.command("remove <names...>")
	.description("Remove extensions")
	.action(async (names: string[]) => {
		const { extensionsRemove } = await import("./commands/extensions.js");
		await extensionsRemove(process.cwd(), names);
	});

ext
	.command("update [names...]")
	.description("Update third-party extensions from their original source")
	.action(async (names: string[]) => {
		const { extensionsUpdate } = await import("./commands/extensions.js");
		await extensionsUpdate(process.cwd(), names);
	});

ext
	.command("suggest")
	.description("Recommend extensions based on project contents")
	.action(async () => {
		const { extensionsSuggest } = await import("./commands/extensions.js");
		await extensionsSuggest(process.cwd());
	});

program
	.command("init-docs")
	.description(
		"Scaffold a VitePress documentation site with Mermaid, llms.txt, and FullscreenDiagram",
	)
	.action(async () => {
		const { initDocs } = await import("./commands/init-docs.js");
		await initDocs(process.cwd());
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
		await checkGates(process.cwd(), { file: opts.file, phase: opts.phase });
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

		const projectRoot = process.cwd();
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

		const projectRoot = process.cwd();
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

		const projectRoot = process.cwd();
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
		stripOverlay(process.cwd());
		console.info("Stripped InDusk overlay from .claude/settings.json");
	});

program
	.command("pr-restore")
	.description("Re-apply InDusk settings overlay after a PR")
	.action(async () => {
		const { applyOverlay } = await import("../lib/settings-overlay.js");
		applyOverlay(process.cwd());
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
		if (opts.from) {
			const { extensionsAdd } = await import("./commands/extensions.js");
			await extensionsAdd(process.cwd(), names[0], opts.from);
		} else {
			const { extensionsEnable } = await import("./commands/extensions.js");
			await extensionsEnable(process.cwd(), names);
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
		await evalSummary(process.cwd(), opts);
	});

eval_
	.command("findings")
	.description("List unresolved eval findings")
	.option("--all", "Show all findings including fixed/ignored")
	.action(async (opts) => {
		const { evalFindings } = await import("./commands/eval.js");
		await evalFindings(process.cwd(), opts);
	});

eval_
	.command("fix <key>")
	.description("Mark an eval finding as fixed")
	.action(async (key: string) => {
		const { evalMark } = await import("./commands/eval.js");
		await evalMark(process.cwd(), key, "fixed");
	});

eval_
	.command("ignore <key>")
	.description("Mark an eval finding as ignored")
	.action(async (key: string) => {
		const { evalMark } = await import("./commands/eval.js");
		await evalMark(process.cwd(), key, "ignored");
	});

eval_
	.command("baseline")
	.description("Run baseline evaluation with vanilla agent")
	.requiredOption("--task <path>", "Path to task prompt file")
	.option("--keep", "Keep baseline worktree after eval")
	.action(async (opts) => {
		const { evalBaseline } = await import("./commands/eval.js");
		await evalBaseline(process.cwd(), opts);
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
			projectRoot: process.cwd(),
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

program.parse();
