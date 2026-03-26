import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ExcalidrawEmbed from "../components/ExcalidrawEmbed.vue";
import FullscreenDiagram from "../components/FullscreenDiagram.vue";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component("FullscreenDiagram", FullscreenDiagram);
		app.component("ExcalidrawEmbed", ExcalidrawEmbed);
	},
} satisfies Theme;
