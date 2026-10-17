import type { Finding, LintRule } from "./lint-types.js";

/**
 * The class half of the no-raw-value rule: a Tailwind utility is a value from
 * a scale under another name, so a stock colour, a step, radius, text size or
 * shadow the foundation's theme does not define, and an arbitrary value, are
 * findings. A stylesheet linter does not see a class; this reads the string
 * literals of markup and source files. The vocabulary here changes when the
 * theme's reset does, and for no other reason.
 *
 * promise: a-mockup-leaves-nothing-undefined
 */

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

/** An arbitrary overflow-wrap or word-break value, as a property (`[overflow-wrap:anywhere]`) or a `wrap-[...]` utility. */
const ARBITRARY_WRAP =
	/^(?:[\w-]+:)*!?(?:\[(?:overflow-wrap|word-break):[^\]]+\]|wrap-\[[^\]]+\])$/;

/** Why a class is outside the foundation, or `undefined` when it is inside (or not a utility at all). */
function classProblem(
	token: string,
	names: Set<string>,
): { rule: LintRule; message: string } | undefined {
	if (ARBITRARY_UTILITY.test(token)) {
		return {
			rule: "arbitrary-class",
			message: ARBITRARY_WRAP.test(token)
				? `arbitrary value in ${token} — use the standard utility: wrap-anywhere, wrap-break-word or break-all`
				: `arbitrary value in ${token} — use a class from the foundation's theme`,
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
export function classFindings(file: string, source: string, names: Set<string>): Finding[] {
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

export const CLASS_SOURCE_EXTENSIONS = new Set([
	".jsx",
	".tsx",
	".js",
	".ts",
	".html",
	".vue",
	".svelte",
	".mdx",
]);
