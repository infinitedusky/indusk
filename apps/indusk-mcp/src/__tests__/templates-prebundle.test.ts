import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { globSync } from "glob";
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

/** Source without comments: a JSDoc usage example is not an import. */
function withoutComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/** Every module specifier a source string imports: `from`, side-effect `import "x"`, `import("x")`. */
function specifiersIn(source: string): string[] {
	const found = new Set<string>();
	for (const match of withoutComments(source).matchAll(
		/(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"'\n]+)["']/g,
	)) {
		found.add(match[1]);
	}
	return [...found];
}

/**
 * The bare specifiers a source string imports, whoever publishes them. A deep
 * one (`@scope/name/sub`, `name/sub`) stays whole: Vite pre-bundles a subpath
 * as its own entry, so listing only the package leaves the subpath to be found mid-run.
 */
function packagesIn(source: string): string[] {
	return [...new Set(specifiersIn(source).filter(isBundledByVite))].sort();
}

/** Relative imports in a source string; a `?query` or a `${` template tail is dropped. */
function relativeImportsIn(source: string): string[] {
	const found = new Set<string>();
	for (const match of withoutComments(source).matchAll(
		/(?:\bfrom\s*|\bimport\s*\(?\s*)["'`](\.[^"'`\n]*)["'`]/g,
	)) {
		found.add(match[1].split(/[?$]/)[0]);
	}
	return [...found];
}

function resolveLocalFile(root: string, fromFile: string, specifier: string): string | undefined {
	const base = join(dirname(fromFile), specifier);
	const candidates = [base, `${base}.ts`, base.replace(/\.js$/, ".ts"), join(base, "index.ts")];
	return candidates.find((c) => existsSync(join(root, c)) && statSync(join(root, c)).isFile());
}

/**
 * The files the browser project loads, relative to `root`: every file its
 * `include` globs match, plus the local modules they import, transitively.
 */
function collectBrowserFiles(root: string, globs: string[]): string[] {
	const queue = globs.flatMap((pattern) => globSync(pattern, { cwd: root, posix: true }));
	const seen = new Set<string>();
	for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
		if (seen.has(file)) continue;
		seen.add(file);
		for (const specifier of relativeImportsIn(readFileSync(join(root, file), "utf-8"))) {
			const local = resolveLocalFile(root, file, specifier);
			if (local) queue.push(local);
		}
	}
	return [...seen].sort();
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
			...new Set(collectBrowserFiles(PACKAGE_ROOT, templatesInclude()).flatMap(importedPackages)),
		].sort();
		expect(imported.length).toBeGreaterThan(0);
		const seen = new Set(listTheProjectSees());
		const missing = imported.filter((pkg) => !seen.has(pkg));
		expect(
			missing,
			"packages the templates project's server would only find mid-run, reloading the page: add each to optimizeDeps.include, and keep `extends: true` on the project — a Vitest project inherits nothing from the root config without it",
		).toEqual([]);
	});

	it("A5: finds side-effect, non-OpenTelemetry, export-from and dynamic imports, deep ones whole", () => {
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
			'// import "commented-out";',
			'/* import "also-commented"; */',
		].join("\n");
		expect(packagesIn(source)).toEqual(
			[
				"@opentelemetry/context-zone",
				"@scope/name/sub",
				"dyn-pkg",
				"plain/deep/path",
				"web-vitals",
			].sort(),
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
				`import "web-vitals";\nawait import(\`./helper.ts?fresh=\${1}\`);\n`,
			);
			writeFileSync(join(dir, "templates", "helper.ts"), 'import "other-pkg";\n');
			const found = collectBrowserFiles(dir, ["templates/**/*.test.ts"]);
			expect(found).toContain("templates/second.test.ts");
			expect(found).toContain("templates/helper.ts");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("A7: reports a subpath import missing when the list names only its package", () => {
		const source = 'import { x } from "pkg/sub";\nimport { y } from "@scope/name/deep";\n';
		const listed = new Set(["pkg", "@scope/name"]);
		const missing = packagesIn(source).filter((entry) => !listed.has(entry));
		expect(
			missing,
			"Vite pre-bundles a subpath as its own entry: list `pkg/sub` itself in optimizeDeps.include, naming only `pkg` leaves the subpath to be found mid-run, reloading the page",
		).toEqual(["@scope/name/deep", "pkg/sub"]);
	});
});
