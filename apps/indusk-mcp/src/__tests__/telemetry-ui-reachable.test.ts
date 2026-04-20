import { describe, expect, it } from "vitest";

/**
 * T2 — Jaeger UI is reachable on `localhost:16686` when the telemetry daemon is running.
 *
 * Spike Phase 1 confirmed this behaviour end-to-end (see
 * `.indusk/planning/local-telemetry/spike-findings.md` §"Item 1"): Jaeger v2 native
 * binary launched with the minimal config returns 200 at the UI port.
 *
 * Test body is skipped at Phase 1 because it requires the platform package
 * (`@infinitedusky/telemetry-binaries-{platform}`) to exist — that package is
 * authored + published in Phase 2. When the package is resolvable,
 * `require.resolve("@infinitedusky/telemetry-binaries-{platform}/bin/jaeger")`
 * returns the binary path, the test spawns it on auto-picked ports, asserts
 * the UI responds 200, then SIGTERMs.
 *
 * Unlock phase: 2 (platform package + daemon lifecycle land together).
 */
describe("T2 — Jaeger UI reachable at localhost:16686", () => {
	it.skip("UI port returns 200 with Jaeger in the response body (unlocks in Phase 2)", async () => {
		// Phase 2 implementation shape (pseudo):
		//
		//   import { createRequire } from "node:module";
		//   import { spawn } from "node:child_process";
		//   import { platform, arch } from "node:process";
		//
		//   const require = createRequire(import.meta.url);
		//   const platformTag = `${platform}-${arch}`;  // e.g. "darwin-arm64"
		//   const jaeger = require.resolve(
		//     `@infinitedusky/telemetry-binaries-${platformTag}/bin/jaeger`,
		//   );
		//
		//   const uiPort = await pickFreePort();
		//   const otlpPort = await pickFreePort();
		//   const child = spawn(jaeger, ["--config=file:test-config.yaml"], {
		//     detached: true,
		//     stdio: "ignore",
		//     env: { ...process.env, JAEGER_UI_PORT: String(uiPort), JAEGER_OTLP_PORT: String(otlpPort) },
		//   });
		//   child.unref();
		//
		//   try {
		//     await waitForReady(`http://localhost:${uiPort}/`, 10_000);
		//     const res = await fetch(`http://localhost:${uiPort}/`);
		//     expect(res.status).toBe(200);
		//     const body = await res.text();
		//     expect(body.toLowerCase()).toContain("jaeger");
		//   } finally {
		//     if (child.pid) process.kill(child.pid, "SIGTERM");
		//   }
		expect(true).toBe(true); // placeholder to keep vitest happy on skip
	});
});
