import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
	test?: { name?: string; include?: string[] };
}

/** `@scope/name/sub` -> `@scope/name`, `name/sub` -> `name`. */
function packageName(specifier: string): string {
	const parts = specifier.split("/");
	return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

/** Specifiers Vite pre-bundles nothing for: local files, Node built-ins, the runner itself. */
function isBundledByVite(specifier: string): boolean {
	return !(
		specifier.startsWith(".") ||
		specifier.startsWith("/") ||
		specifier.startsWith("node:") ||
		specifier === "vitest" ||
		specifier.startsWith("vitest/")
	);
}

/** Every module specifier a source string imports: `from`, side-effect `import "x"`, `import("x")`. */
function specifiersIn(source: string): string[] {
	const found = new Set<string>();
	for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'\n]+)["']/g)) {
		found.add(match[1]);
	}
	return [...found];
}

/** The bare package names a source string imports, whoever publishes them. */
function packagesIn(source: string): string[] {
	return [...new Set(specifiersIn(source).filter(isBundledByVite).map(packageName))].sort();
}

/** The files the browser project loads, relative to `root` (today: two hard-coded names). */
function collectBrowserFiles(_root: string, _globs: string[]): string[] {
	return ["templates/instrumentation.web.ts", "templates/instrumentation.web.test.ts"];
}

function importedPackages(file: string): string[] {
	return packagesIn(readFileSync(join(PACKAGE_ROOT, file), "utf-8"));
}

function templatesProject(): ProjectShape {
	const root = templatesConfig as { test?: { projects?: ProjectShape[] } };
	const project = root.test?.projects?.find((p) => p.test?.name === "templates");
	expect(project, "the templates project is declared").toBeDefined();
	return project as ProjectShape;
}

function templatesInclude(): string[] {
	return templatesProject().test?.include ?? [];
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
			...new Set(
				collectBrowserFiles(PACKAGE_ROOT, templatesInclude()).flatMap(importedPackages),
			),
		].sort();
		expect(imported.length).toBeGreaterThan(0);
		const seen = new Set(listTheProjectSees());
		const missing = imported.filter((pkg) => !seen.has(pkg));
		expect(
			missing,
			"packages the templates project's server would only find mid-run, reloading the page: add each to optimizeDeps.include, and keep `extends: true` on the project — a Vitest project inherits nothing from the root config without it",
		).toEqual([]);
	});

	it("A5: finds side-effect, non-OpenTelemetry, export-from and dynamic imports, as package names", () => {
		const source = [
			'import "@opentelemetry/context-zone";',
			'import { onLCP } from "web-vitals";',
			'export { x } from "@scope/name/sub";',
			'export * from "plain/deep/path";',
			'const m = await import("dyn-pkg");',
			'import { a } from "./local";',
			'import { b } from "../up";',
			'import { c } from "node:fs";',
			'import { d } from "vitest";',
			'import { e } from "vitest/browser";',
		].join("\n");
		expect(packagesIn(source)).toEqual(
			["@opentelemetry/context-zone", "@scope/name", "dyn-pkg", "plain", "web-vitals"].sort(),
		);
	});

	it("A6: reads the files the templates project's globs match, and the local files they import", () => {
		const files = collectBrowserFiles(PACKAGE_ROOT, templatesInclude());
		expect(files).toContain("templates/instrumentation.web.ts");
		expect(files).toContain("templates/instrumentation.web.test.ts");

		const dir = mkdtempSync(join(tmpdir(), "prebundle-"));
		try {
			mkdirSync(join(dir, "templates"));
			writeFileSync(
				join(dir, "templates", "second.test.ts"),
				'import "web-vitals";\nawait import(`./helper.ts?fresh=${1}`);\n',
			);
			writeFileSync(join(dir, "templates", "helper.ts"), 'import "other-pkg";\n');
			const found = collectBrowserFiles(dir, ["templates/**/*.test.ts"]);
			expect(found).toContain("templates/second.test.ts");
			expect(found).toContain("templates/helper.ts");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
