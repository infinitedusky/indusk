import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import { describe, expect, it } from "vitest";

/**
 * promise-timeline — marks are queried in one place.
 *
 * Which marks count — the project filter, an alias's marks renamed to the
 * promise, the query limit — is decided where the Jaeger query is built.
 * `markedSpans` and the timeline's `readTimeline` both read through
 * `marksBetween`; a third reader building its own query would apply its own
 * rules, and two readers disagreeing about a promise's runs is the failure
 * this module exists to prevent.
 */

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the marks query is built once", () => {
	it("only lib/promises/telemetry.ts builds an indusk.promise tag query", async () => {
		const files = await glob("src/**/*.ts", {
			cwd: PACKAGE,
			absolute: true,
			ignore: ["**/__tests__/**", "**/*.test.ts"],
		});
		const builders: string[] = [];
		for (const file of files) {
			const source = await readFile(file, "utf8");
			if (/\[PROMISE_MARK\.promise\]\s*:/.test(source)) builders.push(relative(PACKAGE, file));
		}
		expect(builders, "lesson: a-window-of-marks-is-read-through-one-query").toEqual([
			"src/lib/promises/telemetry.ts",
		]);
	}, 30_000);
});
