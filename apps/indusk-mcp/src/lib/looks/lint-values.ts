import valueParser from "postcss-value-parser";
import stylelint, { type Config, type Plugin, type Rule } from "stylelint";
import strictValue from "stylelint-declaration-strict-value";
import type { CssBlock, Finding } from "./lint-types.js";

/**
 * The raw-value rule: stylelint with `stylelint-declaration-strict-value`
 * finds the raw declarations, and two rules of ours reach what the plugin lets
 * through (a literal behind a function, a mockup reaching outside itself). The
 * strict list and the allowed units change here, and for no other reason.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

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
 * `indusk/shadow-is-a-token`: the value check judges a shadow whole — each
 * layer must equal a shadow token's — so a shadow assembled from other tokens
 * (`0 0 0 var(--space-1) var(--color-dusk-wash)`) passes the rules above part
 * by part and breaks at the live check. Each layer is one `var(--shadow-…)`,
 * or the value is a keyword. A custom property is not judged here: declaring
 * `--shadow-new` is how a shadow is proposed.
 */
const SHADOW_TOKEN = "indusk/shadow-is-a-token";
const SHADOW_KEYWORDS = new Set(["none", "inherit", "initial", "unset"]);
const isShadowToken = (layer: string) => /^var\(\s*--shadow-[\w-]+\s*\)$/.test(layer.trim());
const shadowTokenRule: Rule<boolean> = Object.assign(
	() => (root: Parameters<ReturnType<Rule>>[0], result: Parameters<ReturnType<Rule>>[1]) => {
		root.walkDecls(/^(box|text)-shadow$/, (decl) => {
			const value = decl.value.trim();
			if (SHADOW_KEYWORDS.has(value.toLowerCase())) return;
			const layers = valueParser(value).nodes.reduce<string[]>(
				(acc, n) => {
					if (n.type === "div" && n.value === ",") acc.push("");
					else acc[acc.length - 1] += valueParser.stringify(n);
					return acc;
				},
				[""],
			);
			if (layers.every(isShadowToken)) return;
			stylelint.utils.report({ ruleName: SHADOW_TOKEN, result, node: decl, message: value });
		});
	},
	{ ruleName: SHADOW_TOKEN, messages: {} },
);
const shadowToken = stylelint.createPlugin(SHADOW_TOKEN, shadowTokenRule);

/**
 * Whether a reference stays inside the mockup: a `data:` URI, an in-document
 * fragment (`#gradient`), or the generated `tokens.css` — the foundation,
 * which the approval binds by its own hash and the cockpit inlines.
 */
export const isOwn = (url: string) =>
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
		plugins: [strictValue as Plugin, noLiteral, noExternal, shadowToken],
		rules: {
			"scale-unlimited/declaration-strict-value": [
				STRICT_PROPERTIES.map(String),
				{ ignoreValues: ALLOWED_VALUES, expandShorthand: true, disableFix: true },
			],
			[NO_LITERAL]: [true, { exempt: [...exempt] }],
			[SHADOW_TOKEN]: true,
			...(mockup ? { [NO_EXTERNAL]: true } : {}),
		},
	};
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
	if (w.rule === SHADOW_TOKEN) {
		const value = w.text.replace(` (${SHADOW_TOKEN})`, "");
		return {
			file,
			line,
			value,
			rule: "shadow-not-token",
			message: `shadow ${value} is assembled, not a token — the live check judges a shadow whole; declare it as a --shadow- token and use var()`,
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
export async function cssFindings(
	file: string,
	block: CssBlock,
	{ exempt = [], mockup = false }: { exempt?: readonly string[]; mockup?: boolean } = {},
): Promise<Finding[]> {
	const result = await stylelint.lint({ code: block.code, config: strictConfig(exempt, mockup) });
	const lines = block.code.split("\n");
	const warnings = result.results[0]?.warnings ?? [];
	// An assembled shadow is named as one, not also as a raw value.
	const shadows = new Set(
		warnings.filter((w) => w.rule === SHADOW_TOKEN).map((w) => `${w.line}:${w.column}`),
	);
	const seen = new Set<string>();
	return warnings.flatMap((w) => {
		const position = `${w.line}:${w.column}`;
		if (w.rule !== SHADOW_TOKEN && w.rule !== NO_EXTERNAL && shadows.has(position)) return [];
		const at = `${w.rule === NO_EXTERNAL ? "external" : w.rule === SHADOW_TOKEN ? "shadow" : "raw"}:${position}`;
		if (seen.has(at)) return [];
		seen.add(at);
		return [findingOf(w, file, block, lines)];
	});
}
