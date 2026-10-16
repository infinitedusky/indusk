import { describe, expect, it } from "vitest";
import * as registry from "../lib/promises/registry.js";

/**
 * plans-are-promises A20 — one lookup finds a promise by its name or by an
 * earlier name. The namespace import keeps the file loadable before the
 * function exists, so the row fails on its own assertion.
 */
const entries = [
	{ name: "fast", aliases: ["quick"] },
	{ name: "never-lost", aliases: [] },
] as unknown as registry.PromiseEntry[];

const findPromise = (promises: registry.PromiseEntry[], name: string) =>
	(
		registry as unknown as {
			findPromise: (p: registry.PromiseEntry[], n: string) => registry.PromiseEntry | undefined;
		}
	).findPromise(promises, name);

describe("findPromise", () => {
	it("finds a promise by its name", () => {
		expect(findPromise(entries, "fast")).toBe(entries[0]);
	});
	it("finds the same entry by an old alias", () => {
		expect(findPromise(entries, "quick")).toBe(findPromise(entries, "fast"));
	});
	it("returns nothing for a name that is neither", () => {
		expect(findPromise(entries, "no-such")).toBeUndefined();
	});
});
