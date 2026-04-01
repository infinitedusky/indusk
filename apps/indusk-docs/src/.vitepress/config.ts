import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { withMermaid } from "vitepress-plugin-mermaid";

const config = defineConfig({
	title: "InDusk",
	description: "Development system documentation for InDusk",
	base: "/",
	lastUpdated: true,
	cleanUrls: true,
	ignoreDeadLinks: true,

	markdown: {
		lineNumbers: true,
	},

	mermaid: {
		// theme: "default" for light mode.
		// The plugin auto-switches to "dark" when VitePress dark mode is active.
		// Do NOT set themeVariables — they persist across theme switches and break one mode.
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
			{ text: "Changelog", link: "/changelog" },
		],

		sidebar: {
			"/guide/": [
				{
					text: "Guide",
					items: [
						{ text: "Overview", link: "/guide/" },
						{ text: "Getting Started", link: "/guide/getting-started" },
						{ text: "Walkthrough", link: "/guide/walkthrough" },
						{ text: "Extensions", link: "/guide/extensions" },
					],
				},
			],
			"/reference/": [
				{
					text: "Skills",
					items: [
						{ text: "Overview", link: "/reference/" },
						{ text: "Plan", link: "/reference/skills/plan" },
						{ text: "Work", link: "/reference/skills/work" },
						{ text: "Verify", link: "/reference/skills/verify" },
						{ text: "Context", link: "/reference/skills/context" },
						{ text: "Document", link: "/reference/skills/document" },
						{ text: "Retrospective", link: "/reference/skills/retrospective" },
						{ text: "Onboard", link: "/reference/skills/onboard" },
						{ text: "Extension Spec", link: "/reference/extension-spec" },
					],
				},
				{
					text: "Tools",
					items: [
						{ text: "InDusk MCP", link: "/reference/tools/indusk-mcp" },
						{ text: "Composable.env", link: "/reference/tools/composable-env" },
						{ text: "CodeGraphContext", link: "/reference/tools/codegraph" },
						{ text: "Biome", link: "/reference/tools/biome" },
						{ text: "OpenTelemetry", link: "/reference/tools/otel" },
					],
				},
			],
			"/decisions/": [
				{
					text: "Architecture Decisions",
					items: [
						{ text: "Overview", link: "/decisions/" },
						{ text: "Excalidraw Extension", link: "/decisions/excalidraw-extension" },
						{ text: "VitePress Excalidraw Embed", link: "/decisions/vitepress-excalidraw-embed" },
						{ text: "GSD-Inspired Improvements", link: "/decisions/gsd-inspired-improvements" },
					{ text: "OpenTelemetry Extension", link: "/decisions/otel-extension" },
					],
				},
			],
			"/lessons/": [
				{
					text: "Lessons Learned",
					items: [{ text: "Overview", link: "/lessons/" }],
				},
			],
		},

		socialLinks: [{ icon: "github", link: "https://github.com/infinite-dusky/infinitedusky" }],
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
			noExternal: ["mermaid", "@excalidraw/utils"],
		},
	},
});

export default withMermaid(config);
