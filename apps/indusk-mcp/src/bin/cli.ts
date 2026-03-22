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
	.option("--skills <list>", "Comma-separated domain skills to install (e.g., nextjs,tailwind)")
	.option("--no-domain-skills", "Skip domain skill detection and installation")
	.option("--no-index", "Skip code graph indexing")
	.action(async (opts) => {
		const { init } = await import("./commands/init.js");
		await init(process.cwd(), {
			force: opts.force ?? false,
			skills: opts.skills,
			noDomainSkills: opts.domainSkills === false,
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
