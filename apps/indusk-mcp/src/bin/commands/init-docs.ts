import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export async function initDocs(projectRoot: string): Promise<void> {
	const projectName = basename(projectRoot);
	const docsDir = join(projectRoot, `apps/${projectName}-docs`);

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
	];

	for (const dir of dirs) {
		mkdirSync(join(docsDir, dir), { recursive: true });
	}

	// package.json
	writeFileSync(
		join(docsDir, "package.json"),
		JSON.stringify(
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
					"vitepress-plugin-llms": "^1.12.0",
					"vitepress-plugin-mermaid": "^2.0.10",
					vue: "^3.4.15",
				},
			},
			null,
			"\t",
		) + "\n",
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
import FullscreenDiagram from "../components/FullscreenDiagram.vue";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component("FullscreenDiagram", FullscreenDiagram);
	},
} satisfies Theme;
`,
	);

	// FullscreenDiagram.vue — copy from templates
	const fullscreenDiagramPath = join(docsDir, "src/.vitepress/components/FullscreenDiagram.vue");
	const templateComponent = join(
		projectRoot,
		"apps/indusk-mcp/templates/FullscreenDiagram.vue",
	);
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

	// Dockerfile for local dev
	const dockerDir = join(projectRoot, "docker");
	mkdirSync(dockerDir, { recursive: true });
	const dockerfilePath = join(dockerDir, "Dockerfile.vitepressdev");
	const docsAppName = `${projectName}-docs`;
	if (!existsSync(dockerfilePath)) {
		writeFileSync(
			dockerfilePath,
			`FROM node:22-alpine

RUN apk add --no-cache git
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/${docsAppName}/package.json apps/${docsAppName}/

RUN pnpm install --frozen-lockfile

COPY apps/${docsAppName}/ apps/${docsAppName}/

CMD ["sh", "-c", "pnpm turbo dev --filter=${docsAppName} -- --host"]
`,
		);
		console.info("  created: docker/Dockerfile.vitepressdev");
	} else {
		console.info("  skip: docker/Dockerfile.vitepressdev (already exists)");
	}

	console.info("  created: package.json");
	console.info("  created: .vitepress/config.ts (mermaid + llms plugin)");
	console.info("  created: .vitepress/theme/index.ts");
	console.info("  created: .vitepress/components/FullscreenDiagram.vue");
	console.info("  created: starter pages (index, guide, reference, decisions, lessons)");

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
	console.info("  3. Add reference pages as you build features");
}
