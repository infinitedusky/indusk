import { type DefaultTreeAdapterMap, parseFragment, serialize } from "parse5";
import { elementsOf, type MarkupElement } from "./markup.js";

/**
 * A mockup composed of its components (storybook-components ADR decision 4).
 * A mockup places a component by name — `<indusk-component name="badge"
 * state="ok"></indusk-component>` — and is read with each reference replaced by
 * that story's snapshot (`components/<name>.<state>.html`), so the component a
 * person approved is what the mockup shows. `readApp` composes every mockup
 * here, and the lint, the Looks page's frame, the hash an approval binds and
 * the check all read what it returns.
 *
 * A reference may carry content — the words or components a mockup places in
 * it. Bare content is the component's `children`; `<indusk-content
 * for="<property>">` fills the named property. Each snapshot records, per
 * property, the child-index paths from its root where that property's content
 * lands (`SnapshotBytes.content`, written by the render step); compose parses
 * the snapshot, replaces the node at each path with the content composed in
 * turn (nested references too) and serializes the result. With no content the
 * snapshot's bytes go in untouched.
 *
 * A place is recorded from a second render and holds only where the two
 * renders agree: the path of the node where the property's words begin, how
 * many nodes of the snapshot they are (`nodes` — a story's children may be
 * several), and the static words that share that text node (`before` /
 * `after`). Compose replaces exactly the property's words and leaves the rest.
 * An `<indusk-content>` with no `for`, or inside another, is never content
 * and never emitted: the lint refuses it, compose drops it.
 *
 * Pure: the snapshots are handed in with their hashes, read and hashed by
 * `looks/mockups`, the one place a looks hash is computed. Whether a
 * snapshot is *approved* is `looks/approvals`' question; composition places the
 * snapshot the app holds, and a reference with no snapshot at all is left as
 * written and reported with a null hash.
 *
 * promise: a-mockup-composes-approved-components
 * promise: a-placed-component-shows-its-content
 */

/** The element a mockup names a component with. */
export const COMPONENT_TAG = "indusk-component";

/** The element a mockup names a property's content with, inside a component. */
export const CONTENT_TAG = "indusk-content";

export interface ComponentReference {
	name: string;
	state: string;
	/** 1-based line of the `<indusk-component>` element in the mockup's source. */
	line: number;
}

/** A story's key: `badge.ok`, the snapshot's file name without `.html`. */
export const storyKey = (r: { name: string; state: string }) => `${r.name}.${r.state}`;

/** The components a mockup places by name: `<indusk-component name="badge" state="ok">`. A missing state is `default`. */
export function componentReferences(html: string): ComponentReference[] {
	return referenceElements(html).map(({ ref }) => ref);
}

function referenceElements(html: string) {
	return elementsOf(html)
		.filter((el) => el.tag === COMPONENT_TAG && el.attrs.name)
		.map((el) => ({
			ref: {
				name: el.attrs.name as string,
				state: el.attrs.state || "default",
				line: el.line,
			},
			start: el.start,
			end: el.end,
			innerStart: el.innerStart,
			innerEnd: el.innerEnd,
		}));
}

/**
 * Where one property's content lands in a snapshot: the child-index path from
 * its root to the first node, how many sibling nodes the story's words are
 * (default 1), and the story's static words around them in the same text node.
 */
export interface ContentPlace {
	at: number[];
	nodes?: number;
	before?: string;
	after?: string;
}

/** A place as a catalog stores it: a bare path is a catalog written before places carried more. */
export type StoredPlace = number[] | ContentPlace;

/** Per fillable property, the places its content lands. */
export type ContentMap = Readonly<Record<string, readonly StoredPlace[]>>;

/** The one reader of a stored place. */
export const placeOf = (p: StoredPlace): ContentPlace => (Array.isArray(p) ? { at: p } : p);

export interface SnapshotBytes {
	html: string;
	/** sha256 of the snapshot file's bytes. */
	hash: string;
	/** Per fillable property, where its content lands in the snapshot (written by the render step). */
	content?: ContentMap;
}

export interface ComponentUse extends ComponentReference {
	/** `badge.ok`. */
	story: string;
	/** The hash of the snapshot composed in; null when the app holds no snapshot for this story. */
	snapshotHash: string | null;
}

export interface Composed {
	/** The mockup with every reference that has a snapshot replaced by it; the source itself when it names none. */
	html: string;
	/** Every reference, in document order, with the snapshot hash composed in. */
	uses: ComponentUse[];
}

type Span = { start: number; end: number };
type Reference = ReturnType<typeof referenceElements>[number];

/** Child nodes of a parse5 node, `<template>` contents excluded: snapshots are markup, not documents. */
type FragmentNode = { childNodes?: FragmentNode[]; parentNode?: FragmentNode | null };

const escapeText = (t: string) =>
	t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Replace the nodes at each place with its content, framed by the place's
 * static words. Every property's places are applied together, deepest and last
 * first, so a replacement that changes a node count cannot move a place that
 * is still to be filled.
 */
function fillPlaces(
	root: FragmentNode,
	fills: ReadonlyArray<{ place: ContentPlace; content: string }>,
): void {
	const sorted = [...fills].sort((a, b) => {
		for (let i = 0; i < Math.max(a.place.at.length, b.place.at.length); i++) {
			const d = (b.place.at[i] ?? -1) - (a.place.at[i] ?? -1);
			if (d !== 0) return d;
		}
		return 0;
	});
	for (const { place, content } of sorted) {
		let node: FragmentNode | undefined = root;
		for (const i of place.at) node = node?.childNodes?.[i];
		const parent = node?.parentNode;
		if (!node || !parent?.childNodes) continue;
		const at = parent.childNodes.indexOf(node);
		const framed = escapeText(place.before ?? "") + content + escapeText(place.after ?? "");
		const filled = (parseFragment(framed) as FragmentNode).childNodes ?? [];
		for (const n of filled) n.parentNode = parent;
		parent.childNodes.splice(at, Math.max(1, place.nodes ?? 1), ...filled);
	}
}

/**
 * Replace each `<indusk-component>` in `source` with its story's snapshot,
 * filled with the content the reference carries. Nothing else in the source is
 * touched — a mockup that names no component composes to its own bytes, so an
 * approval made before composition existed still binds it.
 */
export function compose(source: string, snapshots: ReadonlyMap<string, SnapshotBytes>): Composed {
	const refs = referenceElements(source);
	const contentElements = elementsOf(source).filter((el) => el.tag === CONTENT_TAG);
	const uses: ComponentUse[] = refs.map(({ ref }) => {
		const story = storyKey(ref);
		return { ...ref, story, snapshotHash: snapshots.get(story)?.hash ?? null };
	});
	const within = (outer: Span, el: Span) => el.start >= outer.start && el.end <= outer.end;

	/**
	 * `range` of the source with the references directly inside it composed in
	 * and the `drop` spans left out.
	 */
	const render = (range: Span, drop: readonly Span[] = []): string => {
		const parts: Array<Span & { text: string }> = [
			...drop.map((d) => ({ start: d.start, end: d.end, text: "" })),
			...refs
				.filter((r) => within(range, r) && !drop.some((d) => within(d, r)))
				.map((r) => ({ start: r.start, end: r.end, text: renderReference(r) })),
		].sort((a, b) => a.start - b.start || b.end - a.end);
		let out = "";
		let at = range.start;
		for (const p of parts) {
			// Only the outermost in this range; a nested reference is rendered by its parent.
			if (p.start < at) continue;
			out += source.slice(at, p.start) + p.text;
			at = p.end;
		}
		return out + source.slice(at, range.end);
	};

	/** The `<indusk-content>` elements that belong to `r` itself, not to a reference nested in it. */
	const contentOf = (r: Reference): MarkupElement[] =>
		contentElements.filter(
			(c) =>
				within({ start: r.innerStart, end: r.innerEnd }, c) &&
				!refs.some(
					(o) => o !== r && within({ start: r.innerStart, end: r.innerEnd }, o) && within(o, c),
				),
		);

	const renderReference = (r: Reference): string => {
		const snapshot = snapshots.get(storyKey(r.ref));
		if (!snapshot) return source.slice(r.start, r.end);
		const inner = { start: r.innerStart, end: r.innerEnd };
		// Content inside other content is never content; one with no `for` is never content.
		const mine = contentOf(r);
		const top = mine.filter((c) => !mine.some((o) => o !== c && within(innerOf(o), c)));
		const wanted = new Map<string, string>();
		for (const c of top) {
			if (!c.attrs.for) continue;
			const nested = mine.filter((o) => o !== c && within(innerOf(c), o));
			wanted.set(c.attrs.for, render(innerOf(c), nested));
		}
		const bare = render(inner, top);
		if (bare.trim() !== "" && !wanted.has("children")) wanted.set("children", bare.trim());
		if (wanted.size === 0 || !snapshot.content) return snapshot.html;
		const root = parseFragment(snapshot.html) as FragmentNode;
		const fills = Object.entries(snapshot.content).flatMap(([property, places]) => {
			const content = wanted.get(property);
			return content === undefined ? [] : places.map((p) => ({ place: placeOf(p), content }));
		});
		fillPlaces(root, fills);
		return serialize(root as unknown as DefaultTreeAdapterMap["parentNode"]);
	};

	const html = refs.length === 0 ? source : render({ start: 0, end: source.length });
	return { html, uses };
}

const innerOf = (el: MarkupElement): Span => ({ start: el.innerStart, end: el.innerEnd });
