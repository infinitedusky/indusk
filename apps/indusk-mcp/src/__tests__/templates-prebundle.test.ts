import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import templatesConfig from "../../vitest.templates.config.js";

/**
 * promise: a-browser-test-passes-on-a-cold-cache
 *
 * A1 — every package the browser template imports is bundled for its test page
 * before the page loads. A Vitest project inherits nothing from the root config
 * unless it sets `extends: true`, so the list the project's server sees is the
 * root's `optimizeDeps.include` only when it extends, else the project's own.
 * A package missing here is found while a test runs, and Vite reloads the page.
 */

const PACKAGE_ROOT = new URL("../..", import.meta.url).pathname;

interface ProjectShape {
	extends?: boolean | string;
	optimizeDeps?: { include?: string[] };
	test?: { name?: string };
}

function importedPackages(file: string): string[] {
	const source = readFileSync(join(PACKAGE_ROOT, file), "utf-8");
	const found = new Set<string>();
	for (const match of source.matchAll(
		/(?:from\s+|import\s*\(\s*)["'](@opentelemetry\/[^"']+)["']/g,
	)) {
		found.add(match[1]);
	}
	return [...found].sort();
}

function listTheProjectSees(): string[] {
	const root = templatesConfig as {
		optimizeDeps?: { include?: string[] };
		test?: { projects?: ProjectShape[] };
	};
	const project = root.test?.projects?.find((p) => p.test?.name === "templates");
	expect(project, "the templates project is declared").toBeDefined();
	const inherited = project?.extends === true ? (root.optimizeDeps?.include ?? []) : [];
	return [...inherited, ...(project?.optimizeDeps?.include ?? [])];
}

describe("the browser template's pre-bundle list (a-browser-test-passes-on-a-cold-cache)", () => {
	it("A1: bundles every package the template and its test import before the page loads", () => {
		const imported = [
			...new Set([
				...importedPackages("templates/instrumentation.web.ts"),
				...importedPackages("templates/instrumentation.web.test.ts"),
			]),
		].sort();
		expect(imported.length).toBeGreaterThan(0);
		const seen = new Set(listTheProjectSees());
		const missing = imported.filter((pkg) => !seen.has(pkg));
		expect(
			missing,
			"packages the templates project's server would only find mid-run, reloading the page: add each to optimizeDeps.include, and keep `extends: true` on the project — a Vitest project inherits nothing from the root config without it",
		).toEqual([]);
	});
});
