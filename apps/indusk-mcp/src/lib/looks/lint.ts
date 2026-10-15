import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import { type Foundation, isGeneratedCss } from "./foundation.js";
import { CLASS_SOURCE_EXTENSIONS, classFindings } from "./lint-classes.js";
import { componentFindings } from "./lint-components.js";
import type { CssBlock, Finding } from "./lint-types.js";
import { cssFindings, isOwn } from "./lint-values.js";
import { elementsOf } from "./markup.js";
import { appSourceFiles, type ComponentStyle, type LooksApp, type Mockup } from "./mockups.js";

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

/**
 * What the no-raw-value rule reads of a mockup: a file and its markup. A
 * mockup is linted as composed, part by part — its own source, located in its
 * file, and each snapshot it composes, located in the snapshot's — so a
 * finding names the line that holds it, not a line of the composed page.
 */
type MockupPart = Pick<Mockup, "file" | "declaresNew"> & { html: string };

/** The parts of the app's composed mockups: each mockup's source, and each snapshot one composes, once. */
function mockupParts(app: LooksApp): MockupPart[] {
	const composed = new Set(app.mockups.flatMap((m) => m.uses.map((u) => u.story)));
	return [
		...app.mockups.map((m) => ({ file: m.file, html: m.source, declaresNew: m.declaresNew })),
		...app.stories
			.filter((s) => composed.has(s.name))
			.map((s) => ({ file: s.file, html: s.html, declaresNew: [] })),
	];
}

/** The findings of one mockup part: its raw values, and the tokens it uses or adds. */
async function lintMockup(mockup: MockupPart, foundation: Set<string>): Promise<Finding[]> {
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

/**
 * The findings of a component's stylesheet, `components/<name>.css`: read by
 * the rule a mockup's own styles are, so a raw value or an undefined token in
 * a generated sheet is named in its file (ADR decision 10).
 */
async function lintStylesheet(style: ComponentStyle, foundation: Set<string>): Promise<Finding[]> {
	const block: CssBlock = { code: style.css, startLine: 1 };
	const raw = await cssFindings(style.file, block, { mockup: true });
	const tokens = tokenFindings(
		style.file,
		[block],
		{ foundation, declared: new Set(), elsewhere: new Set() },
		true,
	);
	return [...raw, ...tokens];
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

/**
 * Every raw value, undefined token and stock class in an app's composed
 * mockups and declared sources, and the component rules of `lint-components`.
 */
export async function lintApp(root: string, app: LooksApp): Promise<Finding[]> {
	const foundation = namesOf(app.foundation);
	const mockups = await Promise.all(mockupParts(app).map((m) => lintMockup(m, foundation)));
	const styles = await Promise.all(app.styles.map((s) => lintStylesheet(s, foundation)));
	const sources = await lintSources(root, app.sources, foundation);
	const components = await componentFindings(root, app);
	return [...mockups.flat(), ...styles.flat(), ...sources, ...components].sort(byPlace);
}

export type { Finding, LintRule } from "./lint-types.js";
export { literalIn } from "./lint-values.js";
