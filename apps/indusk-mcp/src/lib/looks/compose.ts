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

export interface SnapshotBytes {
	html: string;
	/** sha256 of the snapshot file's bytes. */
	hash: string;
	/** Per fillable property, the child-index paths from the snapshot's root where its content lands. */
	content?: Readonly<Record<string, number[][]>>;
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

/**
 * Replace the node at each path of `property` with `content`, deepest and
 * last first so an earlier replacement cannot move a later path.
 */
function fillAt(root: FragmentNode, paths: readonly number[][], content: string): void {
	const sorted = [...paths].sort((a, b) => {
		for (let i = 0; i < Math.max(a.length, b.length); i++) {
			const d = (b[i] ?? -1) - (a[i] ?? -1);
			if (d !== 0) return d;
		}
		return 0;
	});
	for (const path of sorted) {
		let node: FragmentNode | undefined = root;
		for (const i of path) node = node?.childNodes?.[i];
		const parent = node?.parentNode;
		if (!node || !parent?.childNodes) continue;
		const at = parent.childNodes.indexOf(node);
		const filled = (parseFragment(content) as FragmentNode).childNodes ?? [];
		for (const n of filled) n.parentNode = parent;
		parent.childNodes.splice(at, 1, ...filled);
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
	const contents = elementsOf(source).filter((el) => el.tag === CONTENT_TAG && el.attrs.for);
	const uses: ComponentUse[] = refs.map(({ ref }) => {
		const story = storyKey(ref);
		return { ...ref, story, snapshotHash: snapshots.get(story)?.hash ?? null };
	});

	/** `range` of the source with the references directly inside it composed in. */
	const render = (range: Span, skip: readonly Span[] = []): string => {
		let out = "";
		let at = range.start;
		for (const r of refs) {
			// Only the outermost references in this range; a nested one is rendered by its parent.
			if (r.start < at || r.end > range.end) continue;
			if (skip.some((s) => r.start >= s.start && r.end <= s.end)) continue;
			out += source.slice(at, r.start) + renderReference(r);
			at = r.end;
		}
		return out + source.slice(at, range.end);
	};

	/** The `<indusk-content>` elements that belong to `r` itself, not to a reference nested in it. */
	const contentOf = (r: Reference): MarkupElement[] =>
		contents.filter(
			(c) =>
				c.start >= r.innerStart &&
				c.end <= r.innerEnd &&
				!refs.some(
					(o) =>
						o !== r &&
						o.start >= r.innerStart &&
						o.end <= r.innerEnd &&
						c.start >= o.start &&
						c.end <= o.end,
				),
		);

	const renderReference = (r: Reference): string => {
		const snapshot = snapshots.get(storyKey(r.ref));
		if (!snapshot) return source.slice(r.start, r.end);
		const inner = { start: r.innerStart, end: r.innerEnd };
		const named = contentOf(r);
		const wanted = new Map<string, string>();
		for (const c of named) wanted.set(c.attrs.for as string, render(innerOf(c)));
		const bare = render(
			inner,
			named.map((c) => ({ start: c.start, end: c.end })),
		);
		if (bare.trim() !== "" && !wanted.has("children")) wanted.set("children", bare.trim());
		if (wanted.size === 0 || !snapshot.content) return snapshot.html;
		const root = parseFragment(snapshot.html) as FragmentNode;
		for (const [property, content] of wanted) {
			const paths = snapshot.content[property];
			if (paths) fillAt(root, paths, content);
		}
		return serialize(root as unknown as DefaultTreeAdapterMap["parentNode"]);
	};

	const html = refs.length === 0 ? source : render({ start: 0, end: source.length });
	return { html, uses };
}

const innerOf = (el: MarkupElement): Span => ({ start: el.innerStart, end: el.innerEnd });
