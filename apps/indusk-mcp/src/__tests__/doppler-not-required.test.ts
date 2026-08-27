import { readFileSync } from "node:fs";
import { join } from "node:path";
import { globSync } from "glob";
import { describe, expect, it } from "vitest";

/**
 * An extension that needs an external account must not be required.
 *
 * `required: true` bypasses `detect` entirely, so doppler enabled on every
 * project whether or not it was configured — and then its token check hard-
 * errored demanding a credential the project had no use for. Its own `detect`
 * rule (`.indusk/extensions/doppler/.env`) already asks exactly the right
 * question; `required` was overriding the correct answer.
 *
 * The cost is not the noise. A health check that is permanently red on every
 * project stops being read, which is worse than not having it.
 */
const EXT = join(new URL("../../", import.meta.url).pathname, "extensions");

describe("required-by-default is reserved for substrate InDusk itself ships", () => {
	it("doppler is detect-driven, not required", () => {
		const m = JSON.parse(readFileSync(join(EXT, "doppler", "manifest.json"), "utf-8"));
		expect(m.required ?? false, "doppler needs an external account — detect must decide").toBe(
			false,
		);
		expect(m.detect, "and it must still say how to detect itself").toBeTruthy();
	});

	it("names every required extension, so adding one is a deliberate edit here", () => {
		const required = globSync("*/manifest.json", { cwd: EXT })
			.filter((f) => JSON.parse(readFileSync(join(EXT, f), "utf-8")).required)
			.map((f) => f.split("/")[0])
			.sort();
		// local-telemetry is InDusk's own daemon. Anything else appearing here
		// should have had this conversation first.
		expect(required).toEqual(["local-telemetry"]);
	});
});
