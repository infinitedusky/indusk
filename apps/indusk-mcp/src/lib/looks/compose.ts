import { elementsOf } from "./markup.js";

/**
 * A mockup composed of its components (storybook-components ADR decision 4).
 * A mockup places a component by name — `<indusk-component name="badge"
 * state="ok"></indusk-component>` — and is read with each reference replaced by
 * that story's snapshot (`components/<name>.<state>.html`), so the component a
 * person approved is what the mockup shows. `readApp` composes every mockup
 * here, and the lint, the Looks page's frame, the hash an approval binds and
 * the check all read what it returns.
 *
 * Pure: the snapshots are handed in with their hashes, read and hashed by
 * `looks/mockups`, the one place a looks hash is computed. Whether a
 * snapshot is *approved* is `looks/approvals`' question; composition places the
 * snapshot the app holds, and a reference with no snapshot at all is left as
 * written and reported with a null hash.
 *
 * promise: a-mockup-composes-approved-components
 */

/** The element a mockup names a component with. */
export const COMPONENT_TAG = "indusk-component";

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
		}));
}

export interface SnapshotBytes {
	html: string;
	/** sha256 of the snapshot file's bytes. */
	hash: string;
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

/**
 * Replace each `<indusk-component>` in `source` with its story's snapshot.
 * Nothing else in the source is touched — a mockup that names no component
 * composes to its own bytes, so an approval made before composition existed
 * still binds it.
 */
export function compose(source: string, snapshots: ReadonlyMap<string, SnapshotBytes>): Composed {
	const uses: ComponentUse[] = [];
	let html = "";
	let at = 0;
	for (const { ref, start, end } of referenceElements(source)) {
		const story = storyKey(ref);
		const snapshot = snapshots.get(story);
		uses.push({ ...ref, story, snapshotHash: snapshot?.hash ?? null });
		// A reference inside one already replaced is gone with it.
		if (!snapshot || start < at) continue;
		html += source.slice(at, start) + snapshot.html;
		at = end;
	}
	return { html: at === 0 ? source : html + source.slice(at), uses };
}
