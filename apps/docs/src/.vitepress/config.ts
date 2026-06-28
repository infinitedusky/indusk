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
			{ text: "Dawn", link: "/dawn/" },
			{ text: "Strategy", link: "/strategy/" },
			{ text: "Changelog", link: "/changelog" },
		],

		sidebar: {
			"/guide/": [
				{
					text: "Guide",
					items: [
						{ text: "Overview", link: "/guide/" },
						{ text: "Signal Correlation", link: "/guide/signal-correlation" },
						{ text: "Getting Started", link: "/guide/getting-started" },
						{ text: "Walkthrough", link: "/guide/walkthrough" },
						{ text: "Extensions", link: "/guide/extensions" },
						{ text: "Local Mode", link: "/guide/local-mode" },
						{ text: "Evaluation", link: "/guide/eval" },
						{ text: "Context Beam", link: "/guide/context-beam" },
						{ text: "Test Trajectory", link: "/guide/test-trajectory" },
						{ text: "Falsification Ritual", link: "/guide/falsification-ritual" },
						{ text: "Worktree Setup (Workbench)", link: "/guide/worktree-setup" },
						{ text: "Multi-Agent Coordination", link: "/guide/multi-agent" },
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
						{ text: "Catchup", link: "/reference/skills/catchup" },
						{ text: "Handoff (deprecated)", link: "/reference/skills/handoff" },
						{ text: "Extension Spec", link: "/reference/extension-spec" },
						{ text: "Extensions Index", link: "/reference/extensions/" },
					],
				},
				{
					text: "CLI",
					items: [{ text: "agent", link: "/reference/cli/agent" }],
				},
				{
					text: "Semantic Graph",
					items: [
						{ text: "Overview", link: "/reference/semantic-graph/overview" },
						{ text: "Event Schema", link: "/reference/semantic-graph/event-schema" },
						{ text: "Adapter Interface", link: "/reference/semantic-graph/adapter-interface" },
						{ text: "CGC Adapter", link: "/reference/semantic-graph/cgc-adapter" },
						{ text: "Jj Dependency", link: "/reference/semantic-graph/jj-dependency" },
						{ text: "Runtime Graph", link: "/reference/semantic-graph/runtime-graph" },
						{ text: "Capture Flow", link: "/reference/semantic-graph/capture-flow" },
						{ text: "Rebuild & Replay", link: "/reference/semantic-graph/rebuild-and-replay" },
						{ text: "CLI & MCP Tools", link: "/reference/semantic-graph/cli" },
					],
				},
				{
					text: "Evaluation",
					items: [{ text: "Overview", link: "/reference/eval/overview" }],
				},
				{
					text: "Admin UI",
					items: [
						{ text: "Overview", link: "/reference/admin-ui/overview" },
						{ text: "CLI Reference", link: "/reference/admin-ui/cli" },
						{
							text: "Component Conventions",
							link: "/reference/admin-ui/component-conventions",
						},
					],
				},
				{
					text: "Telemetry",
					items: [
						{ text: "Overview", link: "/reference/telemetry/overview" },
						{ text: "CLI Reference", link: "/reference/telemetry/cli" },
					],
				},
				{
					text: "Tools",
					items: [
						{ text: "InDusk MCP", link: "/reference/tools/indusk-mcp" },
						{ text: "Composable.env", link: "/reference/tools/composable-env" },
						{ text: "CodeGraphContext", link: "/reference/tools/codegraph" },
						{ text: "Graphiti", link: "/reference/tools/graphiti" },
						{ text: "Biome", link: "/reference/tools/biome" },
						{ text: "OpenTelemetry", link: "/reference/tools/otel" },
						{ text: "Infrastructure", link: "/reference/tools/infrastructure" },
						{ text: "Context Beam", link: "/reference/tools/context-beam" },
						{ text: "Highlights", link: "/reference/tools/highlights" },
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
						{ text: "Graphiti Infrastructure", link: "/decisions/graphiti-infrastructure" },
						{ text: "Local Init Mode", link: "/decisions/local-init-mode" },
						{ text: "Semantic Graph Bridge", link: "/decisions/semantic-graph-bridge" },
						{ text: "Context Eval", link: "/decisions/context-eval" },
						{ text: "Context Beam", link: "/decisions/context-beam" },
						{ text: "Tests-First Planning", link: "/decisions/tests-first-planning" },
						{ text: "Falsification Ritual", link: "/decisions/falsification-ritual" },
						{ text: "InDusk Admin UI", link: "/decisions/indusk-admin-ui" },
						{ text: "Admin UI Hosting", link: "/decisions/admin-ui-hosting" },
						{ text: "Multi-Agent Coordination", link: "/decisions/multi-agent-coordination" },
						{ text: "Git-Only Substrate", link: "/decisions/git-only-substrate" },
						{ text: "Git-or-jj Substrate (Superseded)", link: "/decisions/git-or-jj-substrate" },
					],
				},
			],
			"/lessons/": [
				{
					text: "Lessons Learned",
					items: [
						{ text: "Overview", link: "/lessons/" },
						{ text: "Section Shape (Branch-Mergeable Markdown + Lock vs Merge)", link: "/lessons/handoff-multi-agent-section-shape" },
						{ text: "Git-Only Substrate (Falsification + Inherited Bugs)", link: "/lessons/git-only-substrate" },
						{ text: "Git-or-jj Substrate (Ship-and-Reverse Pattern + Brief Author Bias)", link: "/lessons/git-or-jj-substrate" },
						{ text: "Eval Agent MCP Access (Fresh-vs-Resume Path Divergence)", link: "/lessons/eval-agent-mcp-access" },
					],
				},
			],
			"/dawn/": [
				{
					text: "Dawn — Product Definition",
					items: [
						{ text: "Overview", link: "/dawn/" },
						{ text: "Why Dawn", link: "/dawn/why" },
						{ text: "Who Dawn is for", link: "/dawn/who" },
						{ text: "5x on day 1", link: "/dawn/5x-on-day-1" },
						{ text: "Pick, Defer, Cut", link: "/dawn/pick-defer-cut" },
						{ text: "Out of scope", link: "/dawn/out-of-scope" },
					],
				},
				{
					text: "Architecture",
					items: [{ text: "Decisions", link: "/dawn/decisions" }],
				},
			],
			"/strategy/": [
				{
					text: "Strategy",
					items: [
						{ text: "Overview", link: "/strategy/" },
						{
							text: "Midnight & the Landscape (2026-06)",
							link: "/strategy/midnight-and-the-landscape",
						},
					],
				},
			],
		},

		socialLinks: [{ icon: "github", link: "https://github.com/infinite-dusky/infinitedusky" }],
	},

	vite: {
		plugins: [llmstxt()],
		server: {
			host: "0.0.0.0",
			port: 4173,
			strictPort: true,
			allowedHosts: [".orb.local", ".dusk.local", ".dusk.dawn", "localhost"],
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
