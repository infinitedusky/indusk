import { describe, expect, it } from "vitest";

/**
 * T12 — `get_recent_spans` returns matching spans in under 500 ms p95 for
 *       realistic dev loads (~100 spans across 5s).
 *
 * Spike Phase 1 pre-validated the query budget against the raw Jaeger REST API:
 * p50=5.5ms, p95=12.2ms, p99=12.2ms, max=29.5ms (see
 * `.indusk/planning/local-telemetry/spike-findings.md` §"Item 4"). The 500ms
 * budget passes with 40x headroom against the raw API. This test's job is to
 * verify the same budget holds when the call goes through the MCP tool wrapper
 * (which adds JSON shaping, arg validation, and response size trimming).
 *
 * Test body is skipped at Phase 1 because:
 *   1. The MCP tool `get_recent_spans` doesn't exist until Phase 5.
 *   2. The platform package with the Jaeger binary doesn't exist until Phase 2.
 * Both are required to run the full emit→ingest→query→MCP roundtrip under
 * timing.
 *
 * Unlock phase: 5 (MCP tool wrapper lands atop Phase 2's daemon + Phase 3's CLI).
 */
describe("T12 — get_recent_spans query latency under 500 ms p95", () => {
	it.skip("emits 100 spans across 5s, queries via MCP tool 10x, p95 < 500ms (unlocks in Phase 5)", async () => {
		// Phase 5 implementation shape (pseudo):
		//
		//   import { daemonStart, daemonStop } from "../lib/telemetry/daemon.js";
		//   import { getRecentSpans } from "../server/tools/telemetry/get-recent-spans.js";
		//
		//   const { uiPort, otlpPort } = await daemonStart({ memoryLimit: 100_000 });
		//   try {
		//     // Emit 100 spans via OTLP HTTP trickled across 5s
		//     await emitBurst({ port: otlpPort, count: 100, spreadMs: 5_000 });
		//     await sleep(500); // let Jaeger index
		//
		//     // Measure 10 MCP tool calls
		//     const samples: number[] = [];
		//     for (let i = 0; i < 10; i++) {
		//       const t0 = performance.now();
		//       const result = await getRecentSpans({ service: "spike-latency", limit: 100, sinceMs: 60_000 });
		//       samples.push(performance.now() - t0);
		//       expect(result.spans.length).toBeGreaterThan(0);
		//     }
		//     samples.sort((a, b) => a - b);
		//     const p95 = samples[Math.floor(samples.length * 0.95) - 1];
		//     expect(p95, `p95 should be under 500ms — got ${p95}ms; samples ${samples}`).toBeLessThan(500);
		//   } finally {
		//     await daemonStop();
		//   }
		expect(true).toBe(true); // placeholder to keep vitest happy on skip
	});
});
