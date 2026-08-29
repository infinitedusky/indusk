import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * A library is never asked for telemetry it should not emit.
 *
 * dusk declares `otel.role: "library"` and correctly ships no instrumentation —
 * and its otel health checks were permanently red demanding some. Same class as
 * the Doppler check that was red on every project without Doppler: a check that
 * cannot pass for a legitimate project shape.
 *
 * Two causes. `otel.role` was consulted for impl GATES (`shouldEmitOtelGate`)
 * but not for enablement, and otel's detect pattern `**\/instrumentation.{ts,py}`
 * matched a TEMPLATE file shipped by the package rather than real
 * instrumentation.
 */

let root: string;
afterEach(() => {
	if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
});

describe("otel detect does not match template files", () => {
	it("excludes templates/ from the instrumentation pattern", () => {
		const m = JSON.parse(
			readFileSync(join(new URL("../../", import.meta.url).pathname, "extensions/otel/manifest.json"), "utf-8"),
		);
		// The exclusion is its own field rather than negation inside the glob —
		// readable, and the runner can apply it as `ignore` without parsing.
		const excl: string[] = m.detect?.exclude ?? [];
		expect(excl.join(" "), "a packaged template is not evidence of instrumentation").toMatch(
			/templates/,
		);
	});
});

describe("shouldEmitOtelGate governs enablement, not only gates", () => {
	it("is false for a library and true for a service", async () => {
		const { shouldEmitOtelGate } = await import("../lib/config.js");
		root = mkdtempSync(join(tmpdir(), "otel-role-"));
		mkdirSync(join(root, ".indusk"), { recursive: true });
		const write = (o: unknown) =>
			writeFileSync(join(root, ".indusk", "config.json"), JSON.stringify(o));

		write({ otel: { role: "library" } });
		expect(shouldEmitOtelGate(root)).toBe(false);
		write({ otel: { role: "tool" } });
		expect(shouldEmitOtelGate(root)).toBe(false);
		write({ otel: { role: "service" } });
		expect(shouldEmitOtelGate(root)).toBe(true);
		write({});
		expect(shouldEmitOtelGate(root), "unset means service").toBe(true);
	});
});
