import { defineConfig } from "vitepress";
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
		theme: "dark",
		securityLevel: "loose",
		startOnLoad: true,
		maxTextSize: 50000,
		flowchart: {
			useMaxWidth: true,
			htmlLabels: true,
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
					text: "Skills",
					items: [
						{ text: "Overview", link: "/reference/" },
						{ text: "Plan", link: "/reference/skills/plan" },
						{ text: "Work", link: "/reference/skills/work" },
						{ text: "Verify", link: "/reference/skills/verify" },
						{ text: "Context", link: "/reference/skills/context" },
						{ text: "Document", link: "/reference/skills/document" },
						{ text: "Retrospective", link: "/reference/skills/retrospective" },
					],
				},
				{
					text: "Tools",
					items: [
						{ text: "InDusk MCP", link: "/reference/tools/indusk-mcp" },
						{ text: "Composable.env", link: "/reference/tools/composable-env" },
						{ text: "CodeGraphContext", link: "/reference/tools/codegraph" },
						{ text: "Biome", link: "/reference/tools/biome" },
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

		socialLinks: [{ icon: "github", link: "https://github.com/infinite-dusky/infinitedusky" }],
	},

	vite: {
		optimizeDeps: {
			include: ["mermaid"],
		},
		ssr: {
			noExternal: ["mermaid"],
		},
	},
});

export default withMermaid(config);
