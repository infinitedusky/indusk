// clause: an-app-writes-its-signal-from-a-helper-it-owns/one-vocabulary
//
// a-new-project-starts-instrumented, Build Phase 2: T12 - the keys the two signal helpers
// and the settings files spell as strings are the ones the package's vocabulary defines,
// in both directions: nothing written that is not defined, nothing defined that is not
// written. A key changed on one side only fails here, naming it.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_RESOURCE_KEYS, APP_SIGNAL_KEYS } from "../lib/promises/vocabulary.js";

const T = join(__dirname, "../../templates");

/** Keys in code only: line comments, block comments and Python comments are dropped first. */
const code = (file: string): string => {
	expect(existsSync(join(T, file)), `templates/${file} exists`).toBe(true);
	return readFileSync(join(T, file), "utf-8")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*(\/\/|#).*$/gm, "");
};
const keysIn = (file: string): Set<string> =>
	new Set(
		[...code(file).matchAll(/["'](indusk\.[a-z_.]+|deployment\.environment)["']/g)].map(
			(m) => m[1],
		),
	);
const values = (o: Record<string, string> | undefined): Set<string> =>
	new Set(Object.values(o ?? {}));

describe("the helpers write the vocabulary's keys and no others", () => {
	it("the vocabulary defines the app's signal and resource keys", () => {
		expect(
			values(APP_SIGNAL_KEYS).size,
			"APP_SIGNAL_KEYS is exported and not empty",
		).toBeGreaterThan(0);
		expect(
			values(APP_RESOURCE_KEYS).size,
			"APP_RESOURCE_KEYS is exported and not empty",
		).toBeGreaterThan(0);
	});
	for (const file of ["signal.ts", "signal.py"]) {
		it(`${file}: every key it writes is defined, and every signal key is written`, () => {
			const signal = values(APP_SIGNAL_KEYS);
			const resource = values(APP_RESOURCE_KEYS);
			const found = keysIn(file);
			expect([...found].filter((k) => !signal.has(k) && !resource.has(k))).toEqual([]);
			expect([...signal].filter((k) => !found.has(k))).toEqual([]);
		});
	}
	for (const file of ["telemetry-settings.ts", "instrumentation.py"]) {
		it(`${file}: every resource key is the vocabulary's`, () => {
			const resource = values(APP_RESOURCE_KEYS);
			const found = keysIn(file);
			expect([...resource].filter((k) => !found.has(k))).toEqual([]);
			expect([...found].filter((k) => !resource.has(k))).toEqual([]);
		});
	}
});
