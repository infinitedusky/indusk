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
	.option("--no-index", "Skip code graph indexing")
	.action(async (opts) => {
		const { init } = await import("./commands/init.js");
		await init(process.cwd(), {
			force: opts.force ?? false,
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

program
	.command("serve")
	.description("Start the MCP server (used by Claude Code via .mcp.json)")
	.action(async () => {
		const { startServer } = await import("../server/index.js");
		await startServer();
	});

program.parse();
