import { defineConfig } from "vitepress";

export default defineConfig({
	title: "Interview Prep",
	description: "Private interview prep — not for public use",
	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Q&A", link: "/qa/" },
			{ text: "Pitch", link: "/pitch/" },
			{ text: "Layers", link: "/layers/" },
			{ text: "Reference", link: "/reference/" },
			{ text: "Glossary", link: "/glossary/" },
		],
		sidebar: [
			{
				text: "Q&A — Likely Questions",
				collapsed: false,
				items: [
					{ text: "All Q&As", link: "/qa/" },
					{ text: "How do you use AI to develop?", link: "/qa/ai-development" },
					{ text: "How do you scope client work?", link: "/qa/scoping" },
				],
			},
			{
				text: "Meeting Playbook",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/" },
					{ text: "Style & Presence", link: "/style/" },
					{ text: "Sandy's Voice Frames", link: "/voice/" },
				],
			},
			{
				text: "Layers",
				collapsed: false,
				items: [
					{ text: "All Three Layers", link: "/layers/" },
					{ text: "Layer 1 — Day-One Credibility", link: "/layers/1-credibility" },
					{ text: "Layer 2 — Force Multiplier by 90", link: "/layers/2-force-multiplier" },
					{ text: "Layer 3 — Vision (Foundry)", link: "/layers/3-vision" },
				],
			},
			{
				text: "Pitch Assets",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/pitch/" },
					{ text: "Five Paragraphs", link: "/pitch/five-paragraphs" },
					{ text: "Full Script (~3 min)", link: "/pitch/script" },
					{ text: "90-Second Version", link: "/pitch/90sec" },
				],
			},
			{
				text: "Reference — Garrett's Materials",
				collapsed: false,
				items: [
					{ text: "Overview", link: "/reference/" },
					{ text: "Fintech Operating System", link: "/reference/fintech-operating-system" },
					{ text: "Eng x Delivery Team Structure", link: "/reference/team-structure" },
					{ text: "Sayeed Call Key Frames", link: "/reference/sayeed-call" },
				],
			},
			{
				text: "Domain Primers",
				collapsed: true,
				items: [
					{ text: "Cross River", link: "/primers/cross-river" },
					{ text: "Mercury & BaaS", link: "/primers/mercury-baas" },
					{ text: "GENIUS Act", link: "/primers/genius-act" },
					{ text: "Western Union / USDC", link: "/primers/western-union" },
					{ text: "Rain Card", link: "/primers/rain-card" },
					{ text: "Morpho & DeFi Yield", link: "/primers/morpho-yield" },
					{ text: "Perps & Liquidation", link: "/primers/perps" },
					{ text: "DeFi Collateral Mechanics", link: "/primers/defi-collateral" },
				],
			},
			{
				text: "Glossary",
				collapsed: true,
				items: [
					{ text: "Full Glossary", link: "/glossary/" },
				],
			},
		],
	},
});
