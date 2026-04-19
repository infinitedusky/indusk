import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	test: {
		passWithNoTests: true,
		// Browser mode: render React components in real Chromium via Playwright
		// rather than jsdom. Catches CSS / layout / color-rendering issues that
		// jsdom misses. Critical for A9 (color-coded trajectory states must be
		// visually correct) and the broader visual-discipline goal of v1.
		browser: {
			enabled: true,
			provider: playwright(),
			headless: true,
			instances: [{ browser: "chromium" }],
		},
	},
});
