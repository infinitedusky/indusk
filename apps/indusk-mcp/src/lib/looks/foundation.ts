import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import StyleDictionary from "style-dictionary";
import type { DesignTokens } from "style-dictionary/types";

/**
 * The foundation: one DTCG file every visual value in an app comes from
 * (ui-promises ADR). Read once here — the lint, the approvals and the browser
 * check all take the names and values from this module, so no second reader
 * can disagree about what the foundation defines.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

export const FOUNDATION_FILE = "foundation.tokens.json";

/** The `$extensions` key under which a token names its dark-scheme value. */
const DARK_EXTENSION = "dev.indusk";

/** DTCG 2025.10 types the foundation may use. A token of another type is refused by name. */
export const FOUNDATION_TYPES = [
	"color",
	"dimension",
	"fontFamily",
	"fontWeight",
	"shadow",
	"duration",
	"cubicBezier",
] as const;

export interface FoundationToken {
	/** The CSS custom property, e.g. `--space-3`. */
	name: string;
	/** The token's path in the file, e.g. `["space", "3"]`. */
	path: string[];
	type: string;
	/** The CSS value the token resolves to. */
	value: string;
	/**
	 * The value in a dark colour scheme, from `$extensions["dev.indusk"].dark`
	 * (a CSS string): DTCG 2025.10 has no modes, so the file names the dark
	 * value beside the light one. Emitted by `generateCss`; the running-app
	 * check measures the light scheme and holds only `value`.
	 */
	dark?: string;
}

export interface Foundation {
	tokens: FoundationToken[];
	/** sha256 of the file's bytes: an approval is bound to it. */
	hash: string;
}

export class FoundationError extends Error {}

type Node = Record<string, unknown>;

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The DTCG 2025.10 duration object, `{ value, unit }`, as a string Style
 * Dictionary's CSS transforms understand. Every other type it handles itself.
 */
function normalizeDuration(value: unknown): unknown {
	if (isNode(value) && typeof value.value === "number" && typeof value.unit === "string") {
		return `${value.value}${value.unit}`;
	}
	return value;
}

/** A copy of the file's tree with durations normalised, refusing a token with no supported type. */
function prepare(node: Node, inherited: string | undefined, path: string[]): Node {
	const type = typeof node.$type === "string" ? node.$type : inherited;
	const out: Node = {};
	for (const [key, child] of Object.entries(node)) {
		if (key.startsWith("$")) {
			out[key] = child;
			continue;
		}
		if (!isNode(child)) continue;
		const at = [...path, key];
		if ("$value" in child) {
			const tokenType = typeof child.$type === "string" ? child.$type : type;
			if (!tokenType) {
				throw new FoundationError(`token ${at.join(".")} has no $type, and no group gives it one`);
			}
			if (!(FOUNDATION_TYPES as readonly string[]).includes(tokenType)) {
				throw new FoundationError(
					`token ${at.join(".")} has $type "${tokenType}", which the foundation does not use (${FOUNDATION_TYPES.join(", ")})`,
				);
			}
			out[key] = {
				...child,
				$type: tokenType,
				$value: tokenType === "duration" ? normalizeDuration(child.$value) : child.$value,
			};
		} else {
			out[key] = prepare(child, type, at);
		}
	}
	return out;
}

/** Read and validate the app's `foundation.tokens.json` under `appDir` (`.indusk/mockups/<app>`). */
export async function readFoundation(appDir: string): Promise<Foundation> {
	const file = join(appDir, FOUNDATION_FILE);
	let bytes: Buffer;
	try {
		bytes = await readFile(file);
	} catch {
		throw new FoundationError(`no ${FOUNDATION_FILE} in ${appDir}`);
	}
	let tree: unknown;
	try {
		tree = JSON.parse(bytes.toString("utf-8"));
	} catch (err) {
		throw new FoundationError(`${file} is not valid JSON: ${(err as Error).message}`);
	}
	if (!isNode(tree)) throw new FoundationError(`${file} must hold an object of token groups`);

	const dictionary = new StyleDictionary({
		tokens: prepare(tree, undefined, []) as DesignTokens,
		log: { verbosity: "silent", warnings: "disabled", errors: { brokenReferences: "throw" } },
		platforms: { css: { transformGroup: "css" } },
	});
	let resolved: Awaited<ReturnType<typeof dictionary.getPlatformTokens>>;
	try {
		resolved = await dictionary.getPlatformTokens("css");
	} catch (err) {
		throw new FoundationError(`${file}: ${(err as Error).message}`);
	}

	const tokens: FoundationToken[] = resolved.allTokens.map((t) => {
		const dark = (t.$extensions as Node | undefined)?.[DARK_EXTENSION];
		return {
			name: `--${t.name}`,
			path: t.path,
			type: String(t.$type ?? t.type),
			value: String(t.$value ?? t.value),
			...(isNode(dark) && typeof dark.dark === "string" ? { dark: dark.dark } : {}),
		};
	});
	return { tokens, hash: createHash("sha256").update(bytes).digest("hex") };
}

/** Tailwind namespaces a foundation group lands in, and every namespace the theme resets. */
const TAILWIND_GROUP: Readonly<Record<string, string>> = { space: "spacing", easing: "ease" };
const TAILWIND_RESET = [
	"color",
	"spacing",
	"radius",
	"font",
	"text",
	"font-weight",
	"shadow",
	"inset-shadow",
	"drop-shadow",
	"ease",
	"animate",
	"blur",
	"breakpoint",
];

/** The CSS a mockup loads (`:root`), or, for a Tailwind app, an `@theme` block that resets the stock theme to the foundation. */
export function generateCss(f: Foundation, opts: { tailwind?: boolean } = {}): string {
	const header = "/* Generated from foundation.tokens.json — do not edit. */\n";
	const dark = f.tokens.filter((t) => t.dark !== undefined);
	// Dark values are plain custom properties after the light ones, so a Tailwind
	// utility reading `var(--color-ink)` follows the scheme without a variant.
	const darkLines = dark.map((t) => `${t.name}: ${t.dark};`);
	const darkCss =
		dark.length === 0
			? ""
			: `@media (prefers-color-scheme: dark) {\n\t:root:not([data-theme="light"]) {\n\t\tcolor-scheme: dark;\n${darkLines.map((l) => `\t\t${l}`).join("\n")}\n\t}\n}\n:root[data-theme="dark"] {\n\tcolor-scheme: dark;\n${darkLines.map((l) => `\t${l}`).join("\n")}\n}\n`;
	if (!opts.tailwind) {
		const lines = f.tokens.map((t) => `\t${t.name}: ${t.value};`);
		return `${header}:root {\n${lines.join("\n")}\n}\n${darkCss}`;
	}
	const resets = TAILWIND_RESET.map((ns) => `\t--${ns}-*: initial;`);
	const lines = f.tokens.map((t) => {
		const [group, ...rest] = t.path;
		const mapped = TAILWIND_GROUP[group ?? ""];
		const name = mapped ? `--${[mapped, ...rest].join("-")}` : t.name;
		return `\t${name}: ${t.value};`;
	});
	return `${header}@theme {\n${resets.join("\n")}\n${lines.join("\n")}\n}\n${darkCss}`;
}
