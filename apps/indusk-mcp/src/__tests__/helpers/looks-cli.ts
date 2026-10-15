import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ApprovalEntry } from "../../lib/looks/approvals.js";
import { readApp } from "../../lib/looks/mockups.js";
import { runCli } from "./cli.js";

/**
 * What `looks-cli.test.ts` and `looks-lint-rules.test.ts` share: a copy of the
 * fixture app in a temporary project, `indusk looks <args>` run over it, and
 * the readers of its output.
 */

const FIXTURES = join(__dirname, "..", "fixtures");
export const MOCKUPS = ".indusk/mockups/demo";

const roots: string[] = [];

/** Remove every copy `app()` made; each test file calls it from `afterEach`. */
export function removeApps(): void {
	for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
}

/** A copy of a fixture app (`looks-app` unless named) as a project of its own, so a case may change it. */
export function app(fixture = "looks-app"): string {
	const root = mkdtempSync(join(tmpdir(), "looks-cli-"));
	roots.push(root);
	cpSync(join(FIXTURES, fixture), root, { recursive: true });
	mkdirSync(join(root, ".indusk"), { recursive: true });
	writeFileSync(join(root, ".indusk/config.json"), JSON.stringify({ mode: "local" }));
	return root;
}

/**
 * Add a screen `<screen>.default` to the fixture app's `demo` mockups and
 * approve it: the screen is pushed into `screens.json`, its markup is
 * `home.empty.html` with the card's `<main>` replaced by `markup`, and each of
 * `approvals` is pushed to `approved.json` bound to the mockup's hashes. A
 * caller gives only what differs between approvals (`plan`, `at`, optional
 * `components`); the hashes are the helper's.
 */
export async function addApprovedMockup(
	root: string,
	opts: {
		screen: string;
		markup: string;
		approvals: Array<
			Pick<ApprovalEntry, "at"> & Partial<Pick<ApprovalEntry, "plan" | "components">>
		>;
	},
): Promise<void> {
	const mockups = join(root, MOCKUPS);
	const screens = JSON.parse(readFileSync(join(mockups, "screens.json"), "utf-8"));
	screens.screens.push({ name: opts.screen, states: ["default"] });
	writeFileSync(join(mockups, "screens.json"), JSON.stringify(screens));
	const html = readFileSync(join(mockups, "screens/home.empty.html"), "utf-8").replace(
		'<main class="card" data-component="card">Nothing here yet.</main>',
		opts.markup,
	);
	writeFileSync(join(mockups, `screens/${opts.screen}.default.html`), html);

	const name = `${opts.screen}.default`;
	const looks = await readApp(root, "demo");
	const mockup = looks.mockups.find((m) => m.name === name);
	if (!mockup) throw new Error(`the fixture's ${name} mockup was not read`);
	const record = JSON.parse(readFileSync(join(mockups, "approved.json"), "utf-8"));
	for (const a of opts.approvals) {
		record.approvals.push({
			mockup: name,
			mockupHash: mockup.hash,
			foundationHash: looks.foundation.hash,
			declarationsHash: looks.declarationsHash,
			by: "sandy",
			...a,
		});
	}
	writeFileSync(join(mockups, "approved.json"), JSON.stringify(record));
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
