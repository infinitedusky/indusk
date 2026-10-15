import { describe, expect, it } from "vitest";
import { buildCatalog, manifestIndex, snapshotBytes } from "./stories-catalog.js";

const chip = (state: string) => `<span data-component="chip" class="${state}">${state}</span>`;

const input = (rendered: Record<string, string>) => ({
	rendered: new Map(Object.entries(rendered)),
	files: new Map([["chip", "src/Badge.tsx"]]),
	sources: ["src"],
	properties: new Map(),
	order: new Map<string, number>(),
	content: new Map<string, Record<string, number[][]>>(),
});

describe("buildCatalog", () => {
	it("names each component from its snapshot's marker and each state from its story id", () => {
		const { components, writes } = buildCatalog(
			input({ "ui-badge--passing": chip("passing"), "ui-badge--blocked": chip("blocked") }),
		);
		expect(components).toHaveLength(1);
		expect(components[0]).toMatchObject({ name: "chip", file: "src/Badge.tsx" });
		expect([...writes.keys()].sort()).toEqual(["chip.blocked", "chip.passing"]);
		expect(components[0]?.states.map((s) => s.name).sort()).toEqual(["blocked", "passing"]);
	});

	it("hashes the bytes the snapshot is written as", () => {
		const { components } = buildCatalog(input({ "ui-badge--passing": chip("passing") }));
		const written = snapshotBytes(chip("passing"));
		expect(components[0]?.states[0]?.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
		expect(written.endsWith("\n")).toBe(true);
	});

	it("records each state's content paths, and none for a story that wrote none", () => {
		// promise: a-placed-component-shows-its-content
		const base = input({ "ui-badge--a": chip("a"), "ui-badge--b": chip("b") });
		const { components } = buildCatalog({
			...base,
			content: new Map([["ui-badge--a", { children: [[0, 0]] }]]),
		});
		const state = (n: string) => components[0]?.states.find((s) => s.name === n);
		expect(state("a")?.content).toEqual({ children: [[0, 0]] });
		expect(state("b")?.content).toEqual({});
	});

	it("lists states in the order their stories are written", () => {
		const base = input({ "ui-badge--b": chip("b"), "ui-badge--a": chip("a") });
		const { components } = buildCatalog({
			...base,
			order: new Map([
				["ui-badge--b", 0],
				["ui-badge--a", 1],
			]),
		});
		expect(components[0]?.states.map((s) => s.name)).toEqual(["b", "a"]);
	});

	it("refuses a story whose markup carries no data-component, naming the story", () => {
		expect(() => buildCatalog(input({ "ui-x--default": "<div>plain</div>" }))).toThrow(
			/story ui-x--default renders no data-component/,
		);
	});

	it("refuses a component no source marks, naming the story and the component", () => {
		const html = '<span data-component="ghost">x</span>';
		expect(() => buildCatalog(input({ "ui-ghost--default": html }))).toThrow(
			/story ui-ghost--default renders component "ghost"/,
		);
	});

	it("refuses two stories of one component state, naming both", () => {
		expect(() =>
			buildCatalog(input({ "ui-a--same": chip("same"), "ui-b--same": chip("same") })),
		).toThrow(/ui-a--same and ui-b--same both render chip\.same/);
	});
});

describe("manifestIndex", () => {
	it("maps each story id to its component's properties and place", () => {
		const { properties, order } = manifestIndex({
			components: {
				"ui-badge": {
					reactDocgen: {
						props: {
							variant: {
								required: false,
								tsType: { raw: '"a" | "b"' },
								defaultValue: { value: '"a"' },
							},
						},
					},
					stories: [{ id: "ui-badge--a" }, { id: "ui-badge--b" }],
				},
			},
		});
		expect(properties.get("ui-badge--b")).toEqual([
			{ name: "variant", type: '"a" | "b"', required: false, defaultValue: '"a"' },
		]);
		expect(order.get("ui-badge--b")).toBe(1);
	});

	it("reads a manifest with no components as having none", () => {
		expect(manifestIndex({}).properties.size).toBe(0);
	});
});
