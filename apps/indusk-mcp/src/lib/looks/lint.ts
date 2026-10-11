import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import valueParser from "postcss-value-parser";
import stylelint, { type Config, type Plugin, type Rule } from "stylelint";
import strictValue from "stylelint-declaration-strict-value";
import { type Foundation, isGeneratedCss } from "./foundation.js";
import { CLASS_SOURCE_EXTENSIONS, classFindings } from "./lint-classes.js";
import { elementsOf } from "./markup.js";
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
	| "external-reference"
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

/**
 * Whether a reference stays inside the mockup: a `data:` URI, an in-document
 * fragment (`#gradient`), or the generated `tokens.css` — the foundation,
 * which the approval binds by its own hash and the cockpit inlines.
 */
const isOwn = (url: string) =>
	/^data:/i.test(url) || url.startsWith("#") || /(^|\/)tokens\.css$/.test(url);

/**
 * `indusk/no-external-reference`, for a mockup's CSS: an `@import`, or a
 * `url()` that is not its own. A mockup's approval binds its own bytes, so
 * what it draws must be all in them. The message is the URL itself.
 */
const NO_EXTERNAL = "indusk/no-external-reference";
const noExternalRule: Rule<boolean> = Object.assign(
	() => (root: Parameters<ReturnType<Rule>>[0], result: Parameters<ReturnType<Rule>>[1]) => {
		root.walkAtRules("import", (at) => {
			const url = valueParser(at.params).nodes.map((n) =>
				n.type === "function" ? (n.nodes[0]?.value ?? "") : n.type === "string" ? n.value : "",
			);
			const target = url.find(Boolean) ?? at.params;
			if (isOwn(target)) return;
			stylelint.utils.report({ ruleName: NO_EXTERNAL, result, node: at, message: target });
		});
		root.walkDecls((decl) => {
			valueParser(decl.value).walk((node) => {
				if (node.type !== "function" || node.value.toLowerCase() !== "url") return;
				const target = node.nodes[0]?.value ?? "";
				if (isOwn(target)) return;
				stylelint.utils.report({ ruleName: NO_EXTERNAL, result, node: decl, message: target });
			});
		});
	},
	{ ruleName: NO_EXTERNAL, messages: {} },
);
const noExternal = stylelint.createPlugin(NO_EXTERNAL, noExternalRule);

/**
 * The rule for one unit of CSS; `exempt` names the custom properties whose
 * values are not held, and a mockup's CSS is also held to reaching nothing
 * outside it.
 */
function strictConfig(exempt: readonly string[], mockup: boolean): Config {
	return {
		plugins: [strictValue as Plugin, noLiteral, noExternal],
		rules: {
			"scale-unlimited/declaration-strict-value": [
				STRICT_PROPERTIES.map(String),
				{ ignoreValues: ALLOWED_VALUES, expandShorthand: true, disableFix: true },
			],
			[NO_LITERAL]: [true, { exempt: [...exempt] }],
			...(mockup ? { [NO_EXTERNAL]: true } : {}),
		},
	};
}

interface CssBlock {
	code: string;
	/** The 1-based line of `file` the block's first line is on. */
	startLine: number;
}

/** The `<style>` elements and `style=""` attributes of an HTML document, as the browser parses it. */
function cssBlocksOfHtml(html: string): CssBlock[] {
	const blocks: CssBlock[] = [];
	for (const el of elementsOf(html)) {
		if (el.text) blocks.push({ code: el.text.value, startLine: el.text.line });
		const style = el.attrs.style;
		if (style !== undefined) blocks.push({ code: `a{${style}}`, startLine: el.attrLine("style") });
	}
	return blocks;
}

/** Attributes that load something into what an element draws; `<a href>` navigates and is not one. */
const LOADING_ATTRS: Readonly<Record<string, readonly string[]>> = {
	link: ["href"],
	use: ["href", "xlink:href"],
	image: ["href", "xlink:href"],
	object: ["data"],
	"*": ["src", "srcset", "poster"],
};

/**
 * A mockup's elements that load something from outside it: a `<link>`, an
 * `<img>`, a `<script src>`, an `<iframe>`, a `<video poster>`. A mockup is
 * self-contained — its approval binds its own bytes, and what it would load
 * is outside them.
 */
function externalElements(file: string, html: string): Finding[] {
	const findings: Finding[] = [];
	for (const el of elementsOf(html)) {
		for (const attr of [...(LOADING_ATTRS[el.tag] ?? []), ...(LOADING_ATTRS["*"] ?? [])]) {
			const value = el.attrs[attr];
			if (value === undefined || value === "") continue;
			const urls =
				attr === "srcset" ? value.split(",").map((c) => c.trim().split(/\s+/)[0] ?? "") : [value];
			for (const url of urls) {
				if (isOwn(url)) continue;
				findings.push({
					file,
					line: el.attrLine(attr),
					value: url,
					rule: "external-reference",
					message: `<${el.tag} ${attr}="${url}"> reaches outside the mockup — draw it inline, or as a data: URI, so the approval covers it`,
				});
			}
		}
	}
	return findings;
}

/** What follows `property:` in a declaration's source, without the semicolon. */
function valueOfDeclaration(source: string): string {
	return source
		.replace(/^[^:]+:/, "")
		.replace(/;\s*$/, "")
		.replace(/\s+/g, " ")
		.trim();
}

type Warning = Awaited<ReturnType<typeof stylelint.lint>>["results"][number]["warnings"][number];

/** One stylelint warning as a finding: an outside reference names its URL, a raw value its declaration's value. */
function findingOf(w: Warning, file: string, block: CssBlock, lines: string[]): Finding {
	const line = block.startLine + w.line - 1;
	if (w.rule === NO_EXTERNAL) {
		const url = w.text.replace(` (${NO_EXTERNAL})`, "");
		return {
			file,
			line,
			value: url,
			rule: "external-reference",
			message: `${url} reaches outside the mockup — inline it, or use a data: URI, so the approval covers it`,
		};
	}
	const declaration =
		w.endLine === w.line
			? (lines[w.line - 1] ?? "").slice(w.column - 1, (w.endColumn ?? w.column) - 1)
			: lines.slice(w.line - 1, w.endLine).join(" ");
	const value = valueOfDeclaration(declaration);
	return {
		file,
		line,
		value,
		rule: "raw-value",
		message: `raw value ${value} — use a token the foundation defines`,
	};
}

/**
 * The stylesheet findings of one unit of CSS: its raw values, one per
 * declaration — the two value rules may both name the same one, and it is one
 * raw value — and, for a mockup, its outside references.
 */
async function cssFindings(
	file: string,
	block: CssBlock,
	{ exempt = [], mockup = false }: { exempt?: readonly string[]; mockup?: boolean } = {},
): Promise<Finding[]> {
	const result = await stylelint.lint({ code: block.code, config: strictConfig(exempt, mockup) });
	const lines = block.code.split("\n");
	const seen = new Set<string>();
	return (result.results[0]?.warnings ?? []).flatMap((w) => {
		const at = `${w.rule === NO_EXTERNAL ? "external" : "raw"}:${w.line}:${w.column}`;
		if (seen.has(at)) return [];
		seen.add(at);
		return [findingOf(w, file, block, lines)];
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

const namesOf = (f: Foundation) => new Set(f.tokens.map((t) => t.name));

const byPlace = (a: Finding, b: Finding) =>
	a.file.localeCompare(b.file) || a.line - b.line || a.value.localeCompare(b.value);

/** The findings of one mockup: its raw values, and the tokens it uses or adds. */
async function lintMockup(mockup: Mockup, foundation: Set<string>): Promise<Finding[]> {
	const blocks = cssBlocksOfHtml(mockup.html);
	const raw = await Promise.all(
		blocks.map((block) =>
			cssFindings(mockup.file, block, { exempt: mockup.declaresNew, mockup: true }),
		),
	);
	const tokens = tokenFindings(
		mockup.file,
		blocks,
		{ foundation, declared: new Set(mockup.declaresNew), elsewhere: new Set() },
		true,
	);
	return [...raw.flat(), ...tokens, ...externalElements(mockup.file, mockup.html)];
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
		findings.push(...(await cssFindings(file, block)));
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
