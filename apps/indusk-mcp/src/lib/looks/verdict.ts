/**
 * The verdict: a pure function of what a person approved and what the running
 * app measured (ui-promises ADR decision 6). The browser only measures — it
 * hands this module the foundation's approved values, the `:root` custom
 * properties it read, and each element's computed visual properties; whether
 * a look is held is decided here, with no browser, so it is unit-read
 * (`verdict.test.ts`).
 *
 * Two checks:
 *   (a) each approved token's runtime value on `:root` equals the approved value;
 *   (b) each measured element property is a member of the approved values of
 *       its kind — a colour is one of the colours, a length one of the lengths.
 * A token changed in the app alone fails (a) and, through every element that
 * uses it, (b); both name what was seen.
 *
 * promise: tokens-are-held-exactly
 */

/** One measured visual property of one element, as the browser computed it. */
export interface MeasuredElement {
	/** A selector naming the element, e.g. `button.primary`. */
	selector: string;
	/** A CSS property, e.g. `padding-top`. */
	property: string;
	/** Its computed value. */
	actual: string;
}

export interface VerdictInput {
	/** The approved foundation: custom property name (`--space-3`) to CSS value. */
	approved: Record<string, string>;
	/** The same names as read from `:root` in the running app. */
	runtime: Record<string, string>;
	elements: MeasuredElement[];
}

/** What broke: a token (`token`) or an element's property (`element`, `property`). */
export interface Finding {
	token?: string;
	element?: string;
	property?: string;
	approved?: string;
	actual: string;
	/** The closest approved token of the same kind, `--space-3 (12px)`. */
	nearest?: string;
}

export interface Verdict {
	state: "held" | "broken";
	findings: Finding[];
}

type Kind = "color" | "length" | "duration" | "easing" | "shadow" | "weight" | "family";

/** Which kind of approved value each measured property must be a member of. */
const PROPERTY_KIND: Readonly<Record<string, Kind>> = {
	color: "color",
	"background-color": "color",
	"border-top-color": "color",
	"border-right-color": "color",
	"border-bottom-color": "color",
	"border-left-color": "color",
	"padding-top": "length",
	"padding-right": "length",
	"padding-bottom": "length",
	"padding-left": "length",
	"margin-top": "length",
	"margin-right": "length",
	"margin-bottom": "length",
	"margin-left": "length",
	"row-gap": "length",
	"column-gap": "length",
	"border-top-width": "length",
	"border-right-width": "length",
	"border-bottom-width": "length",
	"border-left-width": "length",
	"border-top-left-radius": "length",
	"border-top-right-radius": "length",
	"border-bottom-right-radius": "length",
	"border-bottom-left-radius": "length",
	"font-size": "length",
	"box-shadow": "shadow",
	"font-family": "family",
	"font-weight": "weight",
	"transition-duration": "duration",
	"transition-timing-function": "easing",
};

/** The properties `check` measures, one definition for the browser half. */
export const MEASURED_PROPERTIES: readonly string[] = Object.keys(PROPERTY_KIND);

const COLOR_ONLY = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|color\([^)]*\)|transparent)$/i;

function classify(value: string): Kind {
	const v = value.trim();
	if (COLOR_ONLY.test(v)) return "color";
	if (/^-?[\d.]+(px|rem|em)$/.test(v)) return "length";
	if (/^-?[\d.]+m?s$/.test(v)) return "duration";
	if (/^(cubic-bezier|steps|linear|ease|ease-in|ease-out|ease-in-out)\b/.test(v)) return "easing";
	if (/^\d{3}$/.test(v)) return "weight";
	if (/(#[0-9a-f]{3,8}|rgba?\()/i.test(v) && /\d/.test(v)) return "shadow";
	return "family";
}

/** A comma list split at top level — `cubic-bezier(0.2, 0, 0, 1), ease` is two. */
function splitList(value: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let start = 0;
	for (let i = 0; i < value.length; i++) {
		const c = value[i];
		if (c === "(") depth++;
		else if (c === ")") depth--;
		else if (c === "," && depth === 0) {
			out.push(value.slice(start, i));
			start = i + 1;
		}
	}
	out.push(value.slice(start));
	return out.map((s) => s.trim()).filter(Boolean);
}

function hexToRgb(hex: string): [number, number, number, number] | null {
	let h = hex.slice(1).toLowerCase();
	if (h.length === 3 || h.length === 4) {
		h = h
			.split("")
			.map((c) => c + c)
			.join("");
	}
	if (h.length !== 6 && h.length !== 8) return null;
	const n = (i: number) => Number.parseInt(h.slice(i, i + 2), 16);
	return [n(0), n(2), n(4), h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1];
}

/** rgb components and alpha of a CSS colour, or null when not one we can read. */
function rgba(value: string): [number, number, number, number] | null {
	const v = value.trim().toLowerCase();
	if (v === "transparent") return [0, 0, 0, 0];
	if (v.startsWith("#")) return hexToRgb(v);
	const m = v.match(
		/^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/,
	);
	if (!m) return null;
	// A percentage component is a share of 255: `rgb(9.4% …)` is what a CSS
	// generator may write for #18202b, and the browser computes 24.
	const channel = (c: string | undefined) =>
		c?.endsWith("%") ? Math.round((Number.parseFloat(c) / 100) * 255) : Number.parseFloat(c ?? "0");
	const alpha =
		m[4] === undefined
			? 1
			: m[4].endsWith("%")
				? Number.parseFloat(m[4]) / 100
				: Number.parseFloat(m[4]);
	return [channel(m[1]), channel(m[2]), channel(m[3]), alpha];
}

/** Any colour in a shadow layer: hex, rgb()/rgba(), hsl()/hsla(). */
const SHADOW_COLOR = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/i;

/**
 * One shadow layer in the browser's order — colour, then offsets, blur and
 * spread, each in px, `inset` last — whichever order, colour spelling and
 * shorthand it was written in: `0 1px 2px` is `0px 1px 2px 0px`, as the
 * browser computes it (a hand-written dark value, Build Phase 6).
 */
function canonShadowLayer(layer: string): string {
	const color = layer.match(SHADOW_COLOR)?.[0];
	const words = (color ? layer.replace(color, " ") : layer).trim().toLowerCase().split(/\s+/);
	const inset = words.includes("inset");
	const lengths = words.filter((w) => w !== "" && w !== "inset").map((w) => canon("length", w));
	// Blur and spread default to zero once the two offsets are given.
	while (lengths.length >= 2 && lengths.length < 4) lengths.push("0px");
	return [color ? canon("color", color) : "", ...lengths, inset ? "inset" : ""]
		.filter(Boolean)
		.join(" ");
}

/** Canonical spelling: what the browser would compute for the same value. */
function canon(kind: Kind, value: string): string {
	const v = value.trim();
	switch (kind) {
		case "color": {
			const c = rgba(v);
			if (!c) return v.toLowerCase();
			// Alpha to two places: a minifier that writes 0.06 as #…0f has stored
			// 15/255, and the browser reads it back as 0.06.
			const alpha = Math.round(c[3] * 100) / 100;
			return alpha === 1
				? `rgb(${c[0]}, ${c[1]}, ${c[2]})`
				: `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
		}
		case "shadow":
			return splitList(v).map(canonShadowLayer).join(", ");
		case "length": {
			const m = v.match(/^(-?[\d.]+)(px|rem|em)?$/);
			if (!m) return v;
			const n = Number.parseFloat(m[1] ?? "0") * (m[2] === "px" || m[2] === undefined ? 1 : 16);
			return `${Math.round(n * 1000) / 1000}px`;
		}
		case "duration": {
			const m = v.match(/^(-?[\d.]+)(ms|s)$/);
			if (!m) return v;
			const n = Number.parseFloat(m[1] ?? "0") * (m[2] === "s" ? 1000 : 1);
			return `${Math.round(n * 1000) / 1000}ms`;
		}
		case "easing":
			return (
				v
					// A minifier writes 0.25 as .25; both are the same number.
					.replace(/(^|[^\d])\.(\d)/g, "$10.$2")
					.replace(/\s+/g, " ")
					.replace(/\s*,\s*/g, ", ")
					.toLowerCase()
			);
		case "family":
			return v
				.replace(/["']/g, "")
				.split(",")
				.map((s) => s.trim())
				.join(", ")
				.toLowerCase();
		default:
			return v.replace(/\s+/g, " ").toLowerCase();
	}
}

/** What the browser reports for a property nobody set; never a member of the foundation, never a break. */
function isInitial(kind: Kind, canonical: string): boolean {
	switch (kind) {
		case "color":
			return canonical === "rgba(0, 0, 0, 0)";
		case "length":
			return canonical === "0px" || canonical === "normal" || canonical === "auto";
		case "duration":
			return canonical === "0ms";
		case "easing":
			return canonical === "ease";
		case "shadow":
			// A framework's empty ring and inset layers are shadows that draw nothing.
			return canonical === "none" || canonical === "rgba(0, 0, 0, 0) 0px 0px 0px 0px";
		case "weight":
			return canonical === "400" || canonical === "normal";
		default:
			return false;
	}
}

/** Distance between two canonical values of one kind; null when the kind has no order. */
function distance(kind: Kind, a: string, b: string): number | null {
	if (kind === "color") {
		const x = rgba(a);
		const y = rgba(b);
		if (!x || !y) return null;
		return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
	}
	if (kind === "length" || kind === "duration") {
		return Math.abs(Number.parseFloat(a) - Number.parseFloat(b));
	}
	return null;
}

interface Approved {
	name: string;
	value: string;
	canonical: string;
	kind: Kind;
}

function nearestOf(kind: Kind, canonical: string, pool: Approved[]): string | undefined {
	let best: Approved | undefined;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const candidate of pool) {
		if (candidate.kind !== kind) continue;
		const d = distance(kind, canonical, candidate.canonical);
		if (d === null) {
			best ??= candidate;
			continue;
		}
		if (d < bestDistance) {
			bestDistance = d;
			best = candidate;
		}
	}
	return best ? `${best.name} (${best.value})` : undefined;
}

function checkTokens(approved: Approved[], runtime: Record<string, string>): Finding[] {
	const findings: Finding[] = [];
	for (const token of approved) {
		const seen = runtime[token.name];
		if (seen === undefined) {
			findings.push({ token: token.name, approved: token.value, actual: "(not set)" });
		} else if (canon(token.kind, seen) !== token.canonical) {
			findings.push({ token: token.name, approved: token.value, actual: seen.trim() });
		}
	}
	return findings;
}

function checkElement(el: MeasuredElement, approved: Approved[]): Finding | null {
	const kind = PROPERTY_KIND[el.property];
	if (!kind) return null;
	const parts =
		kind === "duration" || kind === "easing" || kind === "shadow"
			? splitList(el.actual)
			: [el.actual];
	for (const part of parts) {
		const canonical = canon(kind, part);
		if (isInitial(kind, canonical)) continue;
		if (approved.some((a) => a.kind === kind && a.canonical === canonical)) continue;
		const nearest = nearestOf(kind, canonical, approved);
		return {
			element: el.selector,
			property: el.property,
			actual: el.actual.trim(),
			...(nearest ? { nearest } : {}),
		};
	}
	return null;
}

export function verdict(input: VerdictInput): Verdict {
	const approved: Approved[] = Object.entries(input.approved).map(([name, value]) => {
		const kind = classify(value);
		return { name, value, kind, canonical: canon(kind, value) };
	});
	const findings: Finding[] = checkTokens(approved, input.runtime);
	// An element's shadow is judged layer by layer, so each layer of an approved
	// shadow is a member in its own right.
	const members = approved.flatMap((a) =>
		a.kind === "shadow"
			? [
					a,
					...splitList(a.value).map((layer) => ({
						...a,
						value: layer,
						canonical: canon("shadow", layer),
					})),
				]
			: [a],
	);
	for (const el of input.elements) {
		const finding = checkElement(el, members);
		if (finding) findings.push(finding);
	}
	return { state: findings.length === 0 ? "held" : "broken", findings };
}
