import { defineConfig } from "vitepress";

export default defineConfig({
	title: "Project Docs",
	description: "Project documentation",
	themeConfig: {
		nav: [
			{ text: "Home", link: "/" },
			{ text: "Guide", link: "/guide/" },
		],
		sidebar: [
			{
				text: "Guide",
				items: [
					{ text: "Getting Started", link: "/guide/" },
					{ text: "Architecture", link: "/guide/architecture" },
				],
			},
		],
		socialLinks: [{ icon: "github", link: "https://github.com/" }],
	},
});
