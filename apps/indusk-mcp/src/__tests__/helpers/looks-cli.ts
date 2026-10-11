import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./cli.js";

/**
 * What `looks-cli.test.ts` and `looks-lint-rules.test.ts` share: a copy of the
 * fixture app in a temporary project, `indusk looks <args>` run over it, and
 * the readers of its output.
 */

const FIXTURE = join(__dirname, "..", "fixtures", "looks-app");
export const MOCKUPS = ".indusk/mockups/demo";

const roots: string[] = [];

/** Remove every copy `app()` made; each test file calls it from `afterEach`. */
export function removeApps(): void {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
}

/** A copy of the fixture app as a project of its own, so a case may change it. */
export function app(): string {
	const root = mkdtempSync(join(tmpdir(), "looks-cli-"));
	roots.push(root);
	cpSync(FIXTURE, root, { recursive: true });
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local" }));
	return root;
}

export function run(root: string, args: string[]): { code: number; out: string } {
	const r = runCli(root, ["looks", ...args]);
	return { code: r.code, out: `${r.stdout}\n${r.stderr}` };
}

/** The 1-based line of the first line of `file` that holds `needle`. */
export function lineOf(root: string, file: string, needle: string): number {
	const lines = readFileSync(join(root, file), "utf-8").split("\n");
	const i = lines.findIndex((l) => l.includes(needle));
	if (i < 0) throw new Error(`${file} has no line holding ${needle}`);
	return i + 1;
}

/** Output lines that name `file:line` and `value` together. */
export function finding(out: string, file: string, line: number, value: string): string[] {
	return out.split("\n").filter((l) => l.includes(`${file}:${line}`) && l.includes(value));
}

/** The status line for `mockup`, or an empty string so a missing line fails an assertion, not a type. */
export function statusLine(out: string, mockup: string): string {
	const escaped = mockup.replace(/\./g, "\\.");
	const pattern = new RegExp(`^\\s*${escaped}\\s+(approved|proposed)\\b`);
	return out.split("\n").find((l) => pattern.test(l)) ?? "";
}

/** A mockup whose one rule holds `declaration`, loading the generated tokens like the real ones. */
export function rawMockup(declaration: string): string {
	return [
		"<!doctype html>",
		'<html lang="en">',
		"\t<head>",
		'\t\t<meta charset="utf-8" />',
		'\t\t<link rel="stylesheet" href="../tokens.css" />',
		"\t\t<style>",
		`\t\t\t.card { ${declaration} }`,
		"\t\t</style>",
		"\t</head>",
		'\t<body><main class="card" data-component="card"></main></body>',
		"</html>",
		"",
	].join("\n");
}

export const mockupFile = (name: string) => `${MOCKUPS}/screens/${name}.html`;
