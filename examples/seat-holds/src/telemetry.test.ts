// a-new-project-starts-instrumented, Build Phase 6: T33 - the demo's spans say where they
// ran the way a scaffolded app's do: `development` unless something sets the environment.
// The demo's own `SEAT_HOLDS_ENV` (set to `production` by its Dockerfile and fly.toml)
// still wins, and so does `OTEL_RESOURCE_ATTRIBUTES`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoResourceAttributes } from "./telemetry.js";

const environmentOf = (env: NodeJS.ProcessEnv) =>
	demoResourceAttributes(env)["deployment.environment"];

describe("T33 — the demo's spans say where they ran", () => {
	it("T33 says development when nothing sets the environment", () => {
		expect(environmentOf({})).toBe("development");
	});

	it("T33 says the demo's own environment when SEAT_HOLDS_ENV sets it", () => {
		expect(environmentOf({ SEAT_HOLDS_ENV: "production" })).toBe("production");
	});

	it("T33 says the OpenTelemetry resource attribute's environment when that sets it", () => {
		expect(environmentOf({ OTEL_RESOURCE_ATTRIBUTES: "deployment.environment=staging" })).toBe(
			"staging",
		);
	});

	it("T33 keeps the demo's own service name", () => {
		expect(demoResourceAttributes({})["service.name"]).toBe("seat-holds");
	});
});

// mark-first A31: the demo's signal helper writes `broken` for a break, never the older word.
describe("A31 — the demo's helper writes broken", () => {
	it("a break is written as the outcome broken", () => {
		const source = readFileSync(join(import.meta.dirname, "signal.ts"), "utf-8");
		expect(source).toMatch(/outcome: "upheld" \| "broken"/);
		expect(source).not.toMatch(/outcome[^\n]*"violated"/);
	});
});
