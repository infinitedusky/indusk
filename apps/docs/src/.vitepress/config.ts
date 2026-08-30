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
					text: "Start here",
					items: [
						{ text: "What InDusk Is", link: "/guide/" },
						{ text: "Getting Started", link: "/guide/getting-started" },
						{ text: "Walkthrough", link: "/guide/walkthrough" },
					],
				},
				{
					text: "The plan lifecycle",
					items: [
						{ text: "Plan Lifecycle", link: "/guide/plan-lifecycle" },
						{ text: "Test Trajectory", link: "/guide/test-trajectory" },
						{ text: "The Shape Check", link: "/guide/shape" },
						{ text: "Falsification Ritual", link: "/guide/falsification-ritual" },
						{ text: "Cleanup Ritual", link: "/guide/cleanup-ritual" },
					],
				},
				{
					text: "Working across repos",
					items: [
						{ text: "Workbenches & Worktrees", link: "/guide/worktree-setup" },
						{ text: "Sharing a Workbench", link: "/guide/workbench-sharing" },
						{ text: "Multi-Agent Coordination", link: "/guide/multi-agent" },
						{ text: "Environment", link: "/guide/env" },
						{ text: "Extensions", link: "/guide/extensions" },
					],
				},
				{
					text: "How the system behaves",
					items: [
						{ text: "Agent Roles", link: "/guide/agent-roles" },
						{ text: "Evaluation", link: "/guide/eval" },
						{ text: "Context Budget", link: "/guide/context-budget" },
						{ text: "Version Control", link: "/guide/scm" },
						{ text: "Local Mode", link: "/guide/local-mode" },
						{ text: "Rail Check", link: "/guide/rail-check" },
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
						{ text: "claude-md", link: "/reference/skills/claude-md" },
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
					items: [
						{ text: "setup", link: "/reference/cli/setup" },
						{ text: "workbench", link: "/reference/cli/workbench" },
						{ text: "run", link: "/reference/cli/run" },
						{ text: "verify", link: "/reference/cli/verify" },
						{ text: "agent", link: "/reference/cli/agent" },
						{ text: "plans", link: "/reference/cli/plans" },
						{ text: "sync", link: "/reference/cli/sync" },
					],
				},
				{
					text: "Semantic Graph",
					items: [
						{ text: "Overview", link: "/reference/semantic-graph/overview" },
						{ text: "Event Schema", link: "/reference/semantic-graph/event-schema" },
						{ text: "Adapter Interface", link: "/reference/semantic-graph/adapter-interface" },
						{ text: "CGC Adapter", link: "/reference/semantic-graph/cgc-adapter" },
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
				{
					text: "Extensions in depth",
					items: [
						{ text: "worktree", link: "/reference/extensions/worktree" },
						{ text: "doppler", link: "/reference/extensions/doppler" },
					],
				},
				{
					text: "Internals",
					items: [
						{ text: "Trajectory parser", link: "/reference/trajectory/parser" },
						{ text: "Falsification log", link: "/reference/falsification/log" },
					],
				},
			],
			"/decisions/": [
				{
					text: "Decisions",
					items: [
						{ text: "Overview", link: "/decisions/" },
						{ text: "Admin UI Hosting — Decision Summary", link: "/decisions/admin-ui-hosting" },
						{ text: "Cleanup Ritual — Decision Summary", link: "/decisions/cleanup-ritual" },
						{ text: "Context Beam", link: "/decisions/context-beam" },
						{ text: "Context System Evaluation", link: "/decisions/context-eval" },
						{ text: "Dawn External Orchestrator — model-agnostic gated execution", link: "/decisions/dawn-external-orchestrator" },
						{ text: "Dawn Hook Parity — invariants and the eval rail in the thin lane", link: "/decisions/dawn-hook-parity" },
						{ text: "Dawn Verify — phase-boundary verification for work Dawn didn't execute", link: "/decisions/dawn-verify" },
						{ text: "Excalidraw Extension", link: "/decisions/excalidraw-extension" },
						{ text: "Falsification Ritual — Decision Summary", link: "/decisions/falsification-ritual" },
						{ text: "Git-Only Substrate", link: "/decisions/git-only-substrate" },
						{ text: "Git-or-jj Substrate (Superseded)", link: "/decisions/git-or-jj-substrate" },
						{ text: "Graphiti Infrastructure", link: "/decisions/graphiti-infrastructure" },
						{ text: "GSD-Inspired Improvements", link: "/decisions/gsd-inspired-improvements" },
						{ text: "InDusk Admin UI — Decision Summary", link: "/decisions/indusk-admin-ui" },
						{ text: "InDusk Makeover — budgets, decay, removal", link: "/decisions/indusk-makeover" },
						{ text: "The Shape check — craft feedback at the phase boundary", link: "/decisions/lifecycle-rebalance" },
						{ text: "Local Init Mode", link: "/decisions/local-init-mode" },
						{ text: "Multi-Agent Coordination", link: "/decisions/multi-agent-coordination" },
						{ text: "OpenTelemetry Extension", link: "/decisions/otel-extension" },
						{ text: "Semantic Graph Bridge", link: "/decisions/semantic-graph-bridge" },
						{ text: "Test phases as structure", link: "/decisions/test-phase-structure" },
						{ text: "Tests-First Planning — Decision Summary", link: "/decisions/tests-first-planning" },
						{ text: "Versioned Workbench", link: "/decisions/versioned-workbench" },
						{ text: "VitePress Excalidraw Embed", link: "/decisions/vitepress-excalidraw-embed" },
						{ text: "Worktree Visibility", link: "/decisions/worktree-visibility" },
					],
				},
			],
			"/lessons/": [
				{
					text: "Lessons Learned",
					items: [
						{ text: "Overview", link: "/lessons/" },
						{ text: "Lessons — Agent Roles", link: "/lessons/agent-roles" },
						{ text: "Cleanup Ritual — Lessons", link: "/lessons/cleanup-ritual" },
						{ text: "Dawn Hook Parity — Lessons", link: "/lessons/dawn-hook-parity" },
						{ text: "Dawn External Orchestrator — Acceptance Matrix", link: "/lessons/dawn-orchestrator-acceptance-matrix" },
						{ text: "Dawn UI Plan Grouping — Lessons", link: "/lessons/dawn-ui-plan-grouping" },
						{ text: "Lessons from Dawn Verify", link: "/lessons/dawn-verify" },
						{ text: "Lessons — Eval Agent Silent Failure Fix", link: "/lessons/eval-agent-bug-fix" },
						{ text: "eval-agent-mcp-access — Lessons", link: "/lessons/eval-agent-mcp-access" },
						{ text: "Lessons — Eval Agent OpenTelemetry", link: "/lessons/eval-agent-otel" },
						{ text: "Eval Scorecard Format Fix — Lessons", link: "/lessons/eval-scorecard-format-fix" },
						{ text: "Lessons from git-only-substrate", link: "/lessons/git-only-substrate" },
						{ text: "Lessons from git-or-jj-substrate", link: "/lessons/git-or-jj-substrate" },
						{ text: "Section shape: branch-mergeable markdown + the lock-vs-merge split", link: "/lessons/handoff-multi-agent-section-shape" },
						{ text: "The scope of an enforcement test is itself an untested artifact", link: "/lessons/jj-residue-rip-out" },
						{ text: "Lessons from lifecycle-rebalance", link: "/lessons/lifecycle-rebalance" },
						{ text: "Rationale Baseline Frontmatter — Lessons", link: "/lessons/rationale-baseline-frontmatter" },
						{ text: "Lessons — Test phases as structure", link: "/lessons/test-phase-structure" },
						{ text: "Tests first within each phase", link: "/lessons/tests-first-within-each-phase" },
						{ text: "Versioned Workbench — Lessons", link: "/lessons/versioned-workbench" },
						{ text: "Workbench Setup Command — Lessons", link: "/lessons/workbench-setup-command" },
						{ text: "Worktree Visibility — Lessons", link: "/lessons/worktree-visibility" },
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
						{ text: "Roadmap", link: "/strategy/roadmap" },
						{ text: "Signal Correlation", link: "/strategy/signal-correlation" },
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
