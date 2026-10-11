import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import valueParser from "postcss-value-parser";
import stylelint, { type Config, type Plugin, type Rule } from "stylelint";
import strictValue from "stylelint-declaration-strict-value";
import { type Foundation, isGeneratedCss } from "./foundation.js";
import { appSourceFiles, type LooksApp, type Mockup } from "./mockups.js";

/**
 * The no-raw-value rule (ui-promises ADR): every colour, size, space, radius,
 * shadow, font and motion value in a mockup or in the app's source comes from a
 * token the foundation defines, or one the mockup declares new. Stylelint with
 * `stylelint-declaration-strict-value` finds the raw declarations; the token
 * and class checks are the rest of the rule, because a stylesheet linter does
 * not see a Tailwind class.
 *
 * `0`, `auto`, the CSS keywords, percentages, viewport units and grid
 * fractions are not values from a scale and pass; a literal colour, length or
 * duration fails wherever it sits in a value, behind a function included.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

export type LintRule =
	| "raw-value"
	| "undefined-token"
	| "undeclared-token"
	| "redefined-token"
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

/**
 * The properties whose values must be tokens: colour, size, space, radius,
 * border, shadow, font and motion. Box sizes and offsets joined in Build
 * Phase 6 — `width: 13px` is a size like any other — with their allowed
 * units below.
 */
const STRICT_PROPERTIES: readonly RegExp[] = [
	/color$/,
	/^(background|fill|stroke|outline)$/,
	/^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-width)?$/,
	/^(margin|padding)(-.+)?$/,
	/^(row-|column-)?gap$/,
	/^border(-.+)?-radius$/,
	/^(width|height|inline-size|block-size)$/,
	/^(inset(-.+)?|top|right|bottom|left)$/,
	/^outline-(width|offset)$/,
	/^font(-size|-family|-weight)?$/,
	/^line-height$/,
	/^letter-spacing$/,
	/^(box|text)-shadow$/,
	/^transition(-.+)?$/,
	/^animation-(duration|timing-function|delay)$/,
];

const isStrict = (property: string) => STRICT_PROPERTIES.some((re) => re.test(property));

/**
 * Values that are not from a scale and pass: `0`, `auto`, the CSS-wide
 * keywords, a share of the container or the viewport, a grid fraction, the
 * intrinsic sizes.
 */
const ALLOWED_VALUES = [
	"0",
	"auto",
	"inherit",
	"initial",
	"unset",
	"none",
	"transparent",
	"currentColor",
	"/^-?(\\d*\\.)?\\d+(%|vw|vh|dvh|svh|lvh|vmin|vmax|fr)$/",
	"/^(min|max|fit)-content$/",
	// The property a transition names is a keyword, not a value from a scale.
	"/^(all|opacity|transform|color|background|background-color|border-color|box-shadow|width|height)$/",
];

/** A colour written out: `#c2620b`, or a colour function. */
const HEX = /^#[0-9a-f]{3,8}$/i;
const COLOR_FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i;
/** The units of a value from a scale — a length or a duration — written out. */
const SCALE_UNIT = /^(px|rem|em|ms|s)$/i;

/** The first literal colour, length or duration anywhere in a value — inside functions and `var()` fallbacks too. */
export function literalIn(value: string): string | undefined {
	let found: string | undefined;
	valueParser(value).walk((node) => {
		if (found !== undefined) return false;
		if (node.type === "function" && COLOR_FUNCTION.test(node.value)) {
			found = valueParser.stringify(node);
			return false;
		}
		if (node.type !== "word") return undefined;
		if (HEX.test(node.value)) found = node.value;
		const n = valueParser.unit(node.value);
		if (n && SCALE_UNIT.test(n.unit) && Number(n.number) !== 0) found = node.value;
		return undefined;
	});
	return found;
}

/**
 * `indusk/no-literal-value`: the strict-value plugin judges a declaration's
 * value whole and lets a function through, so `rgb(255 0 0)`, `calc(13px *
 * 2)`, a gradient's stops and a `var()` fallback pass it. This rule reads
 * inside every function, for every strict property and every custom
 * property — a custom property is a value from a scale under another name —
 * except those the secondary option exempts (the tokens a mockup declares
 * new, whose values are its proposal).
 */
const NO_LITERAL = "indusk/no-literal-value";
const noLiteralRule: Rule<boolean, { exempt?: string[] }> = Object.assign(
	(_on: boolean, options: { exempt?: string[] } | undefined) =>
		(root: Parameters<ReturnType<Rule>>[0], result: Parameters<ReturnType<Rule>>[1]) => {
			const exempt = new Set(options?.exempt ?? []);
			root.walkDecls((decl) => {
				const custom = decl.prop.startsWith("--");
				if (custom ? exempt.has(decl.prop) : !isStrict(decl.prop)) return;
				const literal = literalIn(decl.value);
				if (literal === undefined) return;
				stylelint.utils.report({
					ruleName: NO_LITERAL,
					result,
					node: decl,
					message: `raw value ${literal} in ${decl.prop}`,
				});
			});
		},
	{ ruleName: NO_LITERAL, messages: {} },
);
const noLiteral = stylelint.createPlugin(NO_LITERAL, noLiteralRule);

/** The rule for one unit of CSS; `exempt` names the custom properties whose values are not held. */
function strictConfig(exempt: readonly string[]): Config {
	return {
		plugins: [strictValue as Plugin, noLiteral],
		rules: {
			"scale-unlimited/declaration-strict-value": [
				STRICT_PROPERTIES.map(String),
				{ ignoreValues: ALLOWED_VALUES, expandShorthand: true, disableFix: true },
			],
			[NO_LITERAL]: [true, { exempt: [...exempt] }],
		},
	};
}

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

/**
 * The raw values in one unit of CSS, one finding per declaration: the two
 * rules may both name the same one, and it is one raw value.
 */
async function rawFindings(
	file: string,
	block: CssBlock,
	exempt: readonly string[] = [],
): Promise<Finding[]> {
	const result = await stylelint.lint({ code: block.code, config: strictConfig(exempt) });
	const lines = block.code.split("\n");
	const seen = new Set<string>();
	return (result.results[0]?.warnings ?? []).flatMap((w) => {
		const at = `${w.line}:${w.column}`;
		if (seen.has(at)) return [];
		seen.add(at);
		const declaration =
			w.endLine === w.line
				? (lines[w.line - 1] ?? "").slice(w.column - 1, (w.endColumn ?? w.column) - 1)
				: lines.slice(w.line - 1, w.endLine).join(" ");
		const value = valueOfDeclaration(declaration);
		return [
			{
				file,
				line: block.startLine + w.line - 1,
				value,
				rule: "raw-value" as const,
				message: `raw value ${value} — use a token the foundation defines`,
			},
		];
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
 * Tokens a unit of CSS defines or uses that nothing defines, and the
 * foundation's own names it defines again. A mockup may add a token only by
 * declaring it new, and may never give a foundation name a value of its own —
 * the foundation is the one place a value is approved. An app's stylesheet may
 * define its own custom properties but not a foundation name (the generated
 * file is not linted at all), and may not use one nothing defines.
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
	for (const { name, line } of refs.flatMap((r) => r.defined)) {
		if (!known.foundation.has(name)) continue;
		findings.push({
			file,
			line,
			value: name,
			rule: "redefined-token",
			message: `${name} is the foundation's — change it in foundation.tokens.json, where a person approves it, not here`,
		});
	}
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

const namesOf = (f: Foundation) => new Set(f.tokens.map((t) => t.name));

const byPlace = (a: Finding, b: Finding) =>
	a.file.localeCompare(b.file) || a.line - b.line || a.value.localeCompare(b.value);

/** The findings of one mockup: its raw values, and the tokens it uses or adds. */
async function lintMockup(mockup: Mockup, foundation: Set<string>): Promise<Finding[]> {
	const blocks = cssBlocksOfHtml(mockup.html);
	const raw = await Promise.all(
		blocks.map((block) => rawFindings(mockup.file, block, mockup.declaresNew)),
	);
	const tokens = tokenFindings(
		mockup.file,
		blocks,
		{ foundation, declared: new Set(mockup.declaresNew), elsewhere: new Set() },
		true,
	);
	return [...raw.flat(), ...tokens];
}

/** The findings of the app's declared source directories: stylesheets, and class names in markup. */
async function lintSources(
	root: string,
	sourceDirs: string[],
	foundation: Set<string>,
): Promise<Finding[]> {
	const findings: Finding[] = [];
	const paths = await appSourceFiles(root, sourceDirs);
	const stylesheets: Array<{ file: string; block: CssBlock }> = [];
	/** The generated foundation file: its names count as defined, its values are the foundation's. */
	const generated: CssBlock[] = [];
	for (const path of paths) {
		const file = relative(root, path);
		const ext = extname(path);
		const text = await readFile(path, "utf-8");
		if (ext === ".css") {
			if (isGeneratedCss(text)) generated.push({ code: text, startLine: 1 });
			else stylesheets.push({ file, block: { code: text, startLine: 1 } });
		} else if (CLASS_SOURCE_EXTENSIONS.has(ext)) {
			findings.push(...classFindings(file, text, foundation));
		}
	}
	const definedInApp = new Set(
		[...stylesheets.map((s) => s.block), ...generated].flatMap((b) =>
			tokenReferences(b).defined.map((d) => d.name),
		),
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
	return findings;
}

/** Every raw value, undefined token and stock class in an app's mockups and declared sources. */
export async function lintApp(root: string, app: LooksApp): Promise<Finding[]> {
	const foundation = namesOf(app.foundation);
	const mockups = await Promise.all(app.mockups.map((m) => lintMockup(m, foundation)));
	const sources = await lintSources(root, app.sources, foundation);
	return [...mockups.flat(), ...sources].sort(byPlace);
}
