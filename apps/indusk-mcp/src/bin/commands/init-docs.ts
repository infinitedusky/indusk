import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readReposRoot, readWorkbenchRepos, repoDir } from "../../lib/worktree/repos.js";

/** `repos_root`, resolved — relative against the workbench, absolute as given. */
function reposRootFor(projectRoot: string): string {
	const declared = readReposRoot(projectRoot);
	if (!declared) return join(projectRoot, "..");
	if (declared.startsWith("/") || declared.startsWith("~")) return declared;
	return join(projectRoot, declared);
}

export async function initDocs(projectRoot: string): Promise<void> {
	// Docs describe the APPLICATION and must travel with it. In a workbench,
	// `projectRoot` is the wrapper — scaffolding there produces a site that is
	// orphaned the moment the app is cloned standalone, and named after the
	// wrapper besides (`looper-workbench-docs`, for looper's docs).
	//
	// A workbench with exactly one declared repo has an unambiguous target. With
	// several it does not, so it refuses and asks rather than guessing which
	// repo the docs belong to.
	const repos = readWorkbenchRepos(projectRoot);
	let target = projectRoot;
	if (repos.length === 1) {
		target = join(reposRootFor(projectRoot), repoDir(repos[0]));
		console.info(`Workbench detected — scaffolding into the application repo: ${repos[0].name}\n`);
	} else if (repos.length > 1) {
		console.error(
			`Error: this workbench declares ${repos.length} repos (${repos.map((r) => r.name).join(", ")}).`,
		);
		console.error("       Run `indusk init-docs` from inside the repo the docs belong to.");
		process.exit(1);
	}

	const projectName = basename(target);
	const docsDir = join(target, "apps/docs");

	if (existsSync(docsDir)) {
		console.info(`Docs app already exists at apps/${projectName}-docs/`);
		console.info("Run 'update' to sync templates.");
		return;
	}

	console.info(`Scaffolding docs site at apps/${projectName}-docs/\n`);

	// Create directory structure
	const dirs = [
		"src/.vitepress/components",
		"src/.vitepress/theme",
		"src/guide",
		"src/reference/skills",
		"src/reference/tools",
		"src/decisions",
		"src/lessons",
		"src/api",
		"src/specs/openapi",
		"src/public",
	];

	for (const dir of dirs) {
		mkdirSync(join(docsDir, dir), { recursive: true });
	}

	// package.json
	writeFileSync(
		join(docsDir, "package.json"),
		`${JSON.stringify(
			{
				name: `${projectName}-docs`,
				version: "0.1.0",
				private: true,
				type: "module",
				scripts: {
					dev: "vitepress dev src --port 4173",
					build: "vitepress build src",
					preview: "vitepress preview src",
				},
				devDependencies: {
					mermaid: "^10.2.2",
					panzoom: "^9.4.3",
					vitepress: "^1.6.3",
					"vitepress-openapi": "^0.1.20",
					"vitepress-plugin-llms": "^1.12.0",
					"vitepress-plugin-mermaid": "^2.0.10",
					vue: "^3.4.15",
				},
			},
			null,
			"\t",
		)}\n`,
	);

	// .vitepress/config.ts
	writeFileSync(
		join(docsDir, "src/.vitepress/config.ts"),
		`import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";

const config = defineConfig({
	title: "${projectName}",
	description: "Documentation for ${projectName}",
	base: "/",
	lastUpdated: true,
	cleanUrls: true,
	ignoreDeadLinks: true,

	markdown: {
		lineNumbers: true,
	},

	mermaid: {
		theme: "default",
		securityLevel: "strict",
		maxTextSize: 50000,
		flowchart: {
			useMaxWidth: true,
			htmlLabels: true,
		},
		sequence: {
			actorFontWeight: "bold",
			messageFontSize: 14,
			actorFontSize: 14,
		},
	},

	themeConfig: {
		search: {
			provider: "local",
		},

		nav: [
			{ text: "Guide", link: "/guide/" },
			{ text: "Reference", link: "/reference/" },
			{ text: "API", link: "/api/" },
			{ text: "Decisions", link: "/decisions/" },
			{ text: "Lessons", link: "/lessons/" },
		],

		sidebar: {
			"/guide/": [
				{
					text: "Guide",
					items: [
						{ text: "Overview", link: "/guide/" },
						{ text: "Getting Started", link: "/guide/getting-started" },
					],
				},
			],
			"/reference/": [
				{
					text: "Reference",
					items: [
						{ text: "Overview", link: "/reference/" },
					],
				},
			],
			"/api/": [
				{
					text: "API",
					items: [{ text: "Overview", link: "/api/" }],
				},
			],
			"/decisions/": [
				{
					text: "Architecture Decisions",
					items: [{ text: "Overview", link: "/decisions/" }],
				},
			],
			"/lessons/": [
				{
					text: "Lessons Learned",
					items: [{ text: "Overview", link: "/lessons/" }],
				},
			],
		},
	},

	vite: {
		plugins: [llmstxt()],
		server: {
			allowedHosts: [".orb.local"],
		},
		optimizeDeps: {
			include: ["mermaid"],
		},
		ssr: {
			noExternal: ["mermaid"],
		},
	},
});

export default withMermaid(config);
`,
	);

	// .vitepress/theme/index.ts
	writeFileSync(
		join(docsDir, "src/.vitepress/theme/index.ts"),
		`import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { theme as openapiTheme, useOpenapi } from "vitepress-openapi/client";
import "vitepress-openapi/dist/style.css";
import FullscreenDiagram from "../components/FullscreenDiagram.vue";
import spec from "../../specs/openapi/openapi.json" with { type: "json" };

export default {
	extends: DefaultTheme,
	async enhanceApp(ctx) {
		const { app } = ctx;
		app.component("FullscreenDiagram", FullscreenDiagram);
		useOpenapi({ spec });
		openapiTheme.enhanceApp(ctx);
	},
} satisfies Theme;
`,
	);

	// FullscreenDiagram.vue — copy from templates
	const fullscreenDiagramPath = join(docsDir, "src/.vitepress/components/FullscreenDiagram.vue");
	const templateComponent = join(projectRoot, "apps/indusk-mcp/templates/FullscreenDiagram.vue");
	// If we have the template in the package, use it; otherwise inline a minimal version
	if (existsSync(templateComponent)) {
		const content = readFileSync(templateComponent, "utf-8");
		writeFileSync(fullscreenDiagramPath, content);
	} else {
		// Use the bundled template from the package
		const { dirname } = await import("node:path");
		const { fileURLToPath } = await import("node:url");
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const packageRoot = join(__dirname, "../../..");
		const bundledTemplate = join(packageRoot, "templates/FullscreenDiagram.vue");
		if (existsSync(bundledTemplate)) {
			const content = readFileSync(bundledTemplate, "utf-8");
			writeFileSync(fullscreenDiagramPath, content);
		} else {
			writeFileSync(
				fullscreenDiagramPath,
				`<template>
  <div class="diagram-container">
    <div class="diagram"><slot></slot></div>
  </div>
</template>

<style scoped>
.diagram-container { position: relative; width: 100%; }
.diagram { width: 100%; padding: 1rem; border-radius: 8px; border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft); }
</style>
`,
			);
			console.info(
				"  warn: FullscreenDiagram created with minimal template (panzoom not included)",
			);
		}
	}

	// Starter pages
	writeFileSync(
		join(docsDir, "src/index.md"),
		`---
layout: home
hero:
  name: ${projectName}
  tagline: Project documentation
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Reference
      link: /reference/
---
`,
	);

	writeFileSync(
		join(docsDir, "src/guide/index.md"),
		`# Guide

How-to guides for working with ${projectName}.

- [Getting Started](/guide/getting-started) — set up the project and start developing
`,
	);

	writeFileSync(
		join(docsDir, "src/guide/getting-started.md"),
		`# Getting Started

## Prerequisites

- Node.js 22+
- pnpm

## Setup

\`\`\`bash
pnpm install
\`\`\`

## Next Steps

Start building!
`,
	);

	writeFileSync(
		join(docsDir, "src/reference/index.md"),
		`# Reference

Reference documentation for ${projectName}.
`,
	);

	writeFileSync(
		join(docsDir, "src/decisions/index.md"),
		`# Architecture Decisions

Architecture decision records for ${projectName}. Each decision documents what was chosen, what was rejected, and why.
`,
	);

	writeFileSync(
		join(docsDir, "src/lessons/index.md"),
		`# Lessons Learned

Insights from building ${projectName}. Each lesson captures what we learned, what surprised us, and what we'd do differently.
`,
	);

	// Placeholder OpenAPI spec — replace with the real spec for ${projectName}.
	writeFileSync(
		join(docsDir, "src/specs/openapi/openapi.json"),
		`${JSON.stringify(
			{
				openapi: "3.0.3",
				info: {
					title: `${projectName} API`,
					version: "0.0.0",
					description: `Replace src/specs/openapi/openapi.json with the real OpenAPI spec for ${projectName}. Add more specs alongside it under src/specs/openapi/ as the API surface grows.`,
				},
				servers: [{ url: "https://api.example.com", description: "Example server" }],
				paths: {
					"/health": {
						get: {
							operationId: "getHealth",
							summary: "Health check",
							tags: ["System"],
							responses: {
								"200": {
									description: "OK",
									content: {
										"application/json": {
											schema: {
												type: "object",
												properties: { status: { type: "string", example: "ok" } },
											},
										},
									},
								},
							},
						},
					},
				},
			},
			null,
			"\t",
		)}\n`,
	);

	writeFileSync(
		join(docsDir, "src/api/index.md"),
		`---
aside: false
outline: false
title: API Reference
---

# API Reference

Rendered from \`src/specs/openapi/openapi.json\` via [vitepress-openapi](https://vitepress-openapi.vercel.app/).
Replace the placeholder spec with the real one for ${projectName}.

<OASpec />
`,
	);

	writeFileSync(
		join(docsDir, "src/changelog.md"),
		`# Changelog

All notable changes to ${projectName} are documented here. Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]
`,
	);

	console.info("  created: package.json");
	console.info("  created: .vitepress/config.ts (mermaid + llms plugin)");
	console.info("  created: .vitepress/theme/index.ts (vitepress-openapi wired)");
	console.info("  created: .vitepress/components/FullscreenDiagram.vue");
	console.info("  created: starter pages (index, guide, reference, api, decisions, lessons)");
	console.info("  created: src/specs/openapi/openapi.json (placeholder — replace with real spec)");

	// Check if pnpm-workspace.yaml includes this app
	const workspacePath = join(projectRoot, "pnpm-workspace.yaml");
	if (existsSync(workspacePath)) {
		const workspace = readFileSync(workspacePath, "utf-8");
		if (!workspace.includes("apps/*") && !workspace.includes(`apps/${projectName}-docs`)) {
			console.info(
				`\n  note: add 'apps/${projectName}-docs' to pnpm-workspace.yaml if not covered by a glob`,
			);
		}
	}

	// Install dependencies
	console.info("\n[Installing dependencies]");
	try {
		execSync("pnpm install", {
			cwd: projectRoot,
			stdio: "inherit",
			timeout: 120000,
		});
		console.info("  done: dependencies installed");
	} catch {
		console.info("  warn: pnpm install failed — run manually");
	}

	console.info(`\nDocs site ready at apps/${projectName}-docs/`);
	console.info("\nNext steps:");
	console.info(`  1. pnpm turbo dev --filter=${projectName}-docs`);
	console.info("  2. Edit src/guide/getting-started.md with your setup instructions");
	console.info("  3. Replace src/specs/openapi/openapi.json with your real OpenAPI spec");
	console.info("  4. Add reference pages as you build features");
}
