import { type DefaultTreeAdapterMap, parse } from "parse5";

/**
 * A mockup read as the browser reads it: elements, their attributes and the
 * lines they sit on, parsed by `parse5` (the WHATWG parser). The lint reads a
 * mockup's styles and outside references from here, and the coverage its
 * `data-component` names, so a name in a comment, a script or a style is
 * text, never an element (ui-promises Build Phase 6, A33, A34).
 *
 * promise: every-part-of-the-ui-is-covered
 */

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];

export interface MarkupElement {
	/** Lower-case tag name. */
	tag: string;
	attrs: Readonly<Record<string, string>>;
	/** The 1-based line the element's start tag is on. */
	line: number;
	/**
	 * Offsets of the whole element in the source, start tag to end tag: what
	 * `looks/compose` replaces. A custom element written self-closing
	 * (`<indusk-component … />`) ends at its start tag — HTML has no such
	 * thing and the parser nests what follows in it, but the author's meaning is
	 * plain.
	 */
	start: number;
	end: number;
	/** Offsets of what sits between the start tag and the end tag; equal when the element has none. */
	innerStart: number;
	innerEnd: number;
	/** The 1-based line an attribute is on; the element's own when it has none. */
	attrLine(name: string): number;
	/** For `<style>`: its text and the line that text starts on. */
	text?: { value: string; line: number };
}

const isElement = (n: Node): n is Element => "tagName" in n;

function childrenOf(n: Node): Node[] {
	if (isElement(n) && n.tagName === "template") {
		return (n as DefaultTreeAdapterMap["template"]).content.childNodes;
	}
	return "childNodes" in n ? n.childNodes : [];
}

function textOf(el: Element): { value: string; line: number } | undefined {
	const texts = el.childNodes.filter((c) => c.nodeName === "#text") as Array<
		DefaultTreeAdapterMap["textNode"]
	>;
	if (texts.length === 0) return undefined;
	return {
		value: texts.map((t) => t.value).join(""),
		line: texts[0]?.sourceCodeLocation?.startLine ?? el.sourceCodeLocation?.startLine ?? 1,
	};
}

/** The elements marked with `data-component` (its value is non-empty), nested ones included, in document order. */
export function markedElementsOf(html: string): MarkupElement[] {
	return elementsOf(html).filter((el) => el.attrs["data-component"]);
}

/** The component names the markup's elements are marked with (`data-component`), nested ones included; never a name in a comment, a script or a style. */
export function markedComponentsOf(html: string): Set<string> {
	return new Set(markedElementsOf(html).map((el) => el.attrs["data-component"] as string));
}

/** Every element of an HTML document, in document order, `<template>` contents included. */
export function elementsOf(html: string): MarkupElement[] {
	const out: MarkupElement[] = [];
	const visit = (n: Node) => {
		if (isElement(n)) {
			const loc = n.sourceCodeLocation;
			const line = loc?.startLine ?? 1;
			const startTagEnd = loc?.startTag?.endOffset;
			const selfClosed =
				n.tagName.includes("-") &&
				startTagEnd !== undefined &&
				html.slice(startTagEnd - 2, startTagEnd) === "/>";
			out.push({
				tag: n.tagName,
				attrs: Object.fromEntries(n.attrs.map((a) => [a.name, a.value])),
				line,
				start: loc?.startOffset ?? 0,
				end: selfClosed ? startTagEnd : (loc?.endOffset ?? 0),
				innerStart: startTagEnd ?? loc?.endOffset ?? 0,
				innerEnd: selfClosed ? startTagEnd : (loc?.endTag?.startOffset ?? loc?.endOffset ?? 0),
				attrLine: (name) => loc?.attrs?.[name]?.startLine ?? line,
				...(n.tagName === "style" ? { text: textOf(n) } : {}),
			});
		}
		for (const child of childrenOf(n)) visit(child);
	};
	visit(parse(html, { sourceCodeLocationInfo: true }));
	return out;
}
