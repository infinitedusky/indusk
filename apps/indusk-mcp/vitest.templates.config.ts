import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

/**
 * The templates' browser test project: the files under `templates/` that run in
 * a page (`instrumentation.web.ts`) are tested in a page — headless Chromium
 * through @vitest/browser-playwright, as apps/indusk-admin runs its component
 * tests. The node suite (vitest.config.ts) excludes `templates/**`; the
 * package's `test` script runs this project after it.
 */
export default defineConfig({
	// Pre-bundled up front: dependencies the template imports are otherwise found
	// while the test page runs, and Vite reloads the page to re-optimize.
	optimizeDeps: {
		include: [
			"@opentelemetry/api",
			"@opentelemetry/sdk-trace-base",
			"@opentelemetry/sdk-trace-web",
			"@opentelemetry/instrumentation",
			"@opentelemetry/instrumentation-fetch",
			"@opentelemetry/instrumentation-document-load",
			"@opentelemetry/instrumentation-user-interaction",
			"@opentelemetry/instrumentation-xml-http-request",
			"@opentelemetry/exporter-trace-otlp-http",
			"@opentelemetry/resources",
			"@opentelemetry/semantic-conventions",
		],
	},
	test: {
		passWithNoTests: true,
		projects: [
			{
				test: {
					name: "templates",
					include: ["templates/**/*.test.ts"],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						screenshotFailures: false,
						instances: [{ browser: "chromium" }],
					},
				},
			},
		],
	},
});
