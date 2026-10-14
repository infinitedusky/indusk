import type { CatalogComponent, CatalogProperty } from "./components.js";
import { markedElementsOf } from "./markup.js";
import { LooksAppError, snapshotHash } from "./mockups.js";

/**
 * What the render step decides once Storybook has rendered: which component
 * each story is a story of, in which state, with which properties — and what
 * it refuses. Pure, so the refusals are tested without a browser; the
 * orchestration and the generated runner config are `looks/stories`.
 *
 * promise: an-agent-can-find-every-component
 */

/** A snapshot's bytes, and so what its hash binds: the markup and a final newline. */
export const snapshotBytes = (html: string): string => `${html}\n`;

interface ManifestComponent {
	reactDocgen?: {
		props?: Record<
			string,
			{
				required?: boolean;
				tsType?: { name?: string; raw?: string };
				description?: string;
				defaultValue?: { value?: string };
			}
		>;
	};
	stories?: Array<{ id: string }>;
}

/** Each story id's component properties and its place among the component's stories. */
export function manifestIndex(manifest: unknown): {
	properties: Map<string, CatalogProperty[]>;
	order: Map<string, number>;
} {
	const properties = new Map<string, CatalogProperty[]>();
	const order = new Map<string, number>();
	const components = (manifest as { components?: Record<string, ManifestComponent> }).components;
	for (const component of Object.values(components ?? {})) {
		const props: CatalogProperty[] = Object.entries(component.reactDocgen?.props ?? {}).map(
			([name, p]) => ({
				name,
				type: p.tsType?.raw ?? p.tsType?.name ?? "unknown",
				...(p.required === undefined ? {} : { required: p.required }),
				...(p.defaultValue?.value === undefined ? {} : { defaultValue: p.defaultValue.value }),
				...(p.description ? { description: p.description } : {}),
			}),
		);
		(component.stories ?? []).forEach((story, i) => {
			properties.set(story.id, props);
			order.set(story.id, i);
		});
	}
	return { properties, order };
}

/** The first `data-component` a rendered story's markup carries: the component it is a story of. */
const componentOf = (html: string): string | undefined =>
	markedElementsOf(html)[0]?.attrs["data-component"];

export interface CatalogInput {
	/** The markup each story rendered, by story id. */
	rendered: ReadonlyMap<string, string>;
	/** The one file each marked component name lives in. */
	files: ReadonlyMap<string, string>;
	/** The app's declared source directories, for the refusal that names them. */
	sources: readonly string[];
	properties: ReadonlyMap<string, CatalogProperty[]>;
	/** A story id's place among its component's stories, for the order of states. */
	order: ReadonlyMap<string, number>;
	/** Where each story's fillable properties land, by story id (`looks/stories`' marker render). */
	content: ReadonlyMap<string, Record<string, number[][]>>;
}

/**
 * The catalog's components and the snapshot each state writes (`<name>.<state>`
 * to markup). A story whose markup carries no `data-component`, one of a
 * component no source marks, and two stories of one component state are
 * refused by story id.
 */
export function buildCatalog(input: CatalogInput): {
	components: CatalogComponent[];
	writes: Map<string, string>;
} {
	const byComponent = new Map<string, CatalogComponent>();
	const writes = new Map<string, string>();
	const storyOf = new Map<string, string>();
	for (const [id, html] of [...input.rendered].sort(([a], [b]) => a.localeCompare(b))) {
		const name = componentOf(html);
		if (name === undefined) {
			throw new LooksAppError(
				`story ${id} renders no data-component element — mark the component's root element, so its snapshot names it`,
			);
		}
		const file = input.files.get(name);
		if (!file) {
			throw new LooksAppError(
				`story ${id} renders component "${name}", which no file under ${input.sources.join(", ")} marks`,
			);
		}
		const state = id.includes("--") ? id.slice(id.indexOf("--") + 2) : id;
		const key = `${name}.${state}`;
		const clash = storyOf.get(key);
		if (clash) {
			throw new LooksAppError(
				`stories ${clash} and ${id} both render ${key} — one story per state`,
			);
		}
		storyOf.set(key, id);
		writes.set(key, html);
		const component = byComponent.get(name) ?? {
			name,
			file,
			properties: input.properties.get(id) ?? [],
			states: [],
		};
		component.states.push({
			name: state,
			id,
			snapshotHash: snapshotHash(snapshotBytes(html)),
			content: input.content.get(id) ?? {},
		});
		byComponent.set(name, component);
	}

	const components = [...byComponent.values()].sort((a, b) => a.name.localeCompare(b.name));
	// A component's states in the order its stories are written.
	for (const c of components) {
		const place = (state: string) =>
			input.order.get(storyOf.get(`${c.name}.${state}`) ?? "") ?? Number.MAX_SAFE_INTEGER;
		c.states.sort((a, b) => place(a.name) - place(b.name) || a.name.localeCompare(b.name));
	}
	return { components, writes };
}
