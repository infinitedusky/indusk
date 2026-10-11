import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import stylelint, { type Config, type Plugin } from "stylelint";
import strictValue from "stylelint-declaration-strict-value";
import type { Foundation } from "./foundation.js";
import type { LooksApp } from "./mockups.js";

/**
 * The no-raw-value rule (ui-promises ADR): every colour, size, space, radius,
 * shadow, font and motion value in a mockup or in the app's source comes from a
 * token the foundation defines, or one the mockup declares new. Stylelint with
 * `stylelint-declaration-strict-value` finds the raw declarations; the token
 * and class checks are the rest of the rule, because a stylesheet linter does
 * not see a Tailwind class.
 *
 * `0`, `auto` and the CSS keywords are not values from a scale and pass.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

export type LintRule =
	| "raw-value"
	| "undefined-token"
	| "undeclared-token"
	| "arbitrary-class"
	| "stock-class";

export interface Finding {
	/** Relative to the project root. */
	file: string;
	line: number;
	/** What is wrong: the raw value, the token's name, the class. */
	value: string;
	rule: LintRule;
	message: string;
}

/** The properties whose values must be tokens: colour, size, space, radius, shadow, font and motion. */
const STRICT_PROPERTIES = [
	"/color$/",
	"/^(background|fill|stroke|border|outline)$/",
	"/^(margin|padding)(-.+)?$/",
	"/^(row-|column-)?gap$/",
	"/^border(-.+)?-radius$/",
	"font-size",
	"line-height",
	"letter-spacing",
	"font-family",
	"font-weight",
	"/^(box|text)-shadow$/",
	"/^transition(-.+)?$/",
	"/^animation-(duration|timing-function|delay)$/",
];

const STRICT_CONFIG: Config = {
	plugins: [strictValue as Plugin],
	rules: {
		"scale-unlimited/declaration-strict-value": [
			STRICT_PROPERTIES,
			{
				ignoreValues: [
					"0",
					"auto",
					"inherit",
					"initial",
					"unset",
					"none",
					"transparent",
					"currentColor",
					// The property a transition names is a keyword, not a value from a scale.
					"/^(all|opacity|transform|color|background|background-color|border-color|box-shadow|width|height)$/",
				],
				disableFix: true,
			},
		],
	},
} as const;

interface CssBlock {
	code: string;
	/** The 1-based line of `file` the block's first line is on. */
	startLine: number;
}

/** The `<style>` blocks and `style=""` attributes of an HTML document. */
function cssBlocksOfHtml(html: string): CssBlock[] {
	const blocks: CssBlock[] = [];
	const lineAt = (index: number) => html.slice(0, index).split("\n").length;
	for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		const open = (m.index ?? 0) + m[0].indexOf(">") + 1;
		blocks.push({ code: m[1] ?? "", startLine: lineAt(open) });
	}
	for (const m of html.matchAll(/\bstyle=(["'])([\s\S]*?)\1/gi)) {
		blocks.push({ code: `a{${m[2] ?? ""}}`, startLine: lineAt(m.index ?? 0) });
	}
	return blocks;
}

/** What follows `property:` in a declaration's source, without the semicolon. */
function valueOfDeclaration(source: string): string {
	return source
		.replace(/^[^:]+:/, "")
		.replace(/;\s*$/, "")
		.replace(/\s+/g, " ")
		.trim();
}

async function rawFindings(file: string, block: CssBlock): Promise<Finding[]> {
	const result = await stylelint.lint({ code: block.code, config: STRICT_CONFIG });
	const lines = block.code.split("\n");
	return (result.results[0]?.warnings ?? []).map((w) => {
		const declaration =
			w.endLine === w.line
				? (lines[w.line - 1] ?? "").slice(w.column - 1, (w.endColumn ?? w.column) - 1)
				: lines.slice(w.line - 1, w.endLine).join(" ");
		const value = valueOfDeclaration(declaration);
		return {
			file,
			line: block.startLine + w.line - 1,
			value,
			rule: "raw-value",
			message: `raw value ${value} — use a token the foundation defines`,
		};
	});
}

/** The token definitions (`--x: …`) and uses (`var(--x)`) in a block, with their lines. */
function tokenReferences(block: CssBlock) {
	const defined: Array<{ name: string; line: number }> = [];
	const used: Array<{ name: string; line: number }> = [];
	block.code.split("\n").forEach((text, i) => {
		const line = block.startLine + i;
		for (const m of text.matchAll(/(?:^|[{;\s])(--[\w-]+)\s*:/g)) {
			defined.push({ name: m[1] as string, line });
		}
		for (const m of text.matchAll(/var\(\s*(--[\w-]+)/g)) {
			used.push({ name: m[1] as string, line });
		}
	});
	return { defined, used };
}

/**
 * Tokens a unit of CSS defines or uses that nothing defines. A mockup may add a
 * token only by declaring it new; an app's stylesheet may define its own
 * custom properties but may not use one nothing defines.
 */
function tokenFindings(
	file: string,
	blocks: CssBlock[],
	known: { foundation: Set<string>; declared: Set<string>; elsewhere: Set<string> },
	mockup: boolean,
): Finding[] {
	const findings: Finding[] = [];
	const refs = blocks.map(tokenReferences);
	const local = new Set(refs.flatMap((r) => r.defined.map((d) => d.name)));
	if (mockup) {
		for (const { name, line } of refs.flatMap((r) => r.defined)) {
			if (known.foundation.has(name) || known.declared.has(name)) continue;
			findings.push({
				file,
				line,
				value: name,
				rule: "undeclared-token",
				message: `${name} is a token this mockup adds and does not declare — add it to <meta name="indusk-new-tokens">, or use one the foundation defines`,
			});
		}
	}
	for (const { name, line } of refs.flatMap((r) => r.used)) {
		const defined =
			known.foundation.has(name) ||
			known.declared.has(name) ||
			local.has(name) ||
			known.elsewhere.has(name);
		if (defined) continue;
		findings.push({
			file,
			line,
			value: name,
			rule: "undefined-token",
			message: `${name} is undefined — the foundation does not define it`,
		});
	}
	return findings;
}

const STOCK_COLORS =
	"slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_UTILITY = new RegExp(
	`^(?:bg|text|border|ring|fill|stroke|outline|divide|accent|caret|decoration|shadow|from|via|to|placeholder)-((?:black|white)|(?:${STOCK_COLORS})-\\d{2,3})$`,
);
const SPACE_UTILITY =
	/^(?:p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?)$/;
const RADIUS_UTILITY = /^rounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|ee|es))?-([a-z0-9]+)$/;
const TEXT_SIZE_UTILITY = /^text-(xs|sm|base|lg|xl|[2-9]xl)$/;
const SHADOW_UTILITY = /^shadow-(sm|md|lg|xl|2xl|inner)$/;
const ARBITRARY_UTILITY =
	/^(?:[\w-]+:)*!?-?[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]]+\](?:\/[\w.]+)?$|^(?:[\w-]+:)*\[[\w-]+:[^\]]+\]$/;

/** Why a class is outside the foundation, or `undefined` when it is inside (or not a utility at all). */
function classProblem(
	token: string,
	names: Set<string>,
): { rule: LintRule; message: string } | undefined {
	if (ARBITRARY_UTILITY.test(token)) {
		return {
			rule: "arbitrary-class",
			message: `arbitrary value in ${token} — use a class from the foundation's theme`,
		};
	}
	const base = (token.split(":").pop() ?? token).replace(/^!/, "").replace(/^-/, "");
	const stock = (reason: string) => ({
		rule: "stock-class" as const,
		message: `${token} is ${reason} — the foundation's theme does not define it`,
	});
	const color = COLOR_UTILITY.exec(base);
	if (color) return names.has(`--color-${color[1]}`) ? undefined : stock("a stock Tailwind colour");
	const space = SPACE_UTILITY.exec(base);
	if (space) {
		return space[1] === "0" || names.has(`--space-${space[1]}`)
			? undefined
			: stock("a step the foundation's spacing scale lacks");
	}
	const radius = RADIUS_UTILITY.exec(base);
	if (radius) {
		const step = radius[1] as string;
		return step === "none" || step === "full" || names.has(`--radius-${step}`)
			? undefined
			: stock("a radius the foundation lacks");
	}
	const size = TEXT_SIZE_UTILITY.exec(base);
	if (size) return names.has(`--text-${size[1]}`) ? undefined : stock("a stock text size");
	const shadow = SHADOW_UTILITY.exec(base);
	if (shadow) return names.has(`--shadow-${shadow[1]}`) ? undefined : stock("a stock shadow");
	return undefined;
}

/** Every class-like token in a string literal of a source file, with its line. */
function classFindings(file: string, source: string, names: Set<string>): Finding[] {
	const findings: Finding[] = [];
	source.split("\n").forEach((text, i) => {
		for (const literal of text.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
			for (const token of (literal[2] ?? "").split(/\s+/)) {
				const problem = token ? classProblem(token, names) : undefined;
				if (problem) findings.push({ file, line: i + 1, value: token, ...problem });
			}
		}
	});
	return findings;
}

const CLASS_SOURCE_EXTENSIONS = new Set([
	".jsx",
	".tsx",
	".js",
	".ts",
	".html",
	".vue",
	".svelte",
	".mdx",
]);

async function sourceFiles(dir: string): Promise<string[]> {
	const out: string[] = [];
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const entry of entries) {
		if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await sourceFiles(path)));
		else out.push(path);
	}
	return out.sort();
}

const namesOf = (f: Foundation) => new Set(f.tokens.map((t) => t.name));

const byPlace = (a: Finding, b: Finding) =>
	a.file.localeCompare(b.file) || a.line - b.line || a.value.localeCompare(b.value);

/** Every raw value, undefined token and stock class in an app's mockups and declared sources. */
export async function lintApp(root: string, app: LooksApp): Promise<Finding[]> {
	const foundation = namesOf(app.foundation);
	const findings: Finding[] = [];

	for (const mockup of app.mockups) {
		const blocks = cssBlocksOfHtml(mockup.html);
		for (const block of blocks) findings.push(...(await rawFindings(mockup.file, block)));
		findings.push(
			...tokenFindings(
				mockup.file,
				blocks,
				{ foundation, declared: new Set(mockup.declaresNew), elsewhere: new Set() },
				true,
			),
		);
	}

	const sources = (await Promise.all(app.sources.map((s) => sourceFiles(join(root, s))))).flat();
	const stylesheets: Array<{ file: string; block: CssBlock }> = [];
	for (const path of sources) {
		const file = relative(root, path);
		const ext = extname(path);
		const text = await readFile(path, "utf-8");
		if (ext === ".css") stylesheets.push({ file, block: { code: text, startLine: 1 } });
		else if (CLASS_SOURCE_EXTENSIONS.has(ext)) {
			findings.push(...classFindings(file, text, foundation));
		}
	}
	const definedInApp = new Set(
		stylesheets.flatMap((s) => tokenReferences(s.block).defined.map((d) => d.name)),
	);
	for (const { file, block } of stylesheets) {
		findings.push(...(await rawFindings(file, block)));
		findings.push(
			...tokenFindings(
				file,
				[block],
				{ foundation, declared: new Set(), elsewhere: definedInApp },
				false,
			),
		);
	}

	return findings.sort(byPlace);
}
