import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import FullscreenDiagram from "../components/FullscreenDiagram.vue";

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component("FullscreenDiagram", FullscreenDiagram);
	},
} satisfies Theme;
