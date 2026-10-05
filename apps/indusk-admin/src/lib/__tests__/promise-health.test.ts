import { afterEach, describe, expect, it } from "vitest";
import { fakeSource } from "@/__tests__/helpers/fake-source";
import {
  PROMISE,
  type PromiseFixture,
  promiseRegistry,
} from "@/__tests__/helpers/promise-registry";
import {
  type HealthRow,
  healthRows,
  readHealth,
  ruleFor,
  type SourceHealthRead,
} from "@/lib/promise-health";

/**
 * test-kinds A4, A5, A10–A12 — the chips' rules, with runs fed from a list and
 * time moved by the test (ADR D2). Each chip is computed the way the page
 * computes it: `readHealth`, then `healthRows` under the source's `ruleFor`.
 * These replaced HTTP tests that booted `next dev` and real Jaeger servers;
 * each was seen red against its rule broken in the source.
 */

const LESSON = "lesson: code-that-decides-takes-its-clock-and-its-reads";
const T0 = Date.parse("2026-10-05T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const TRACE = "a".repeat(32);

const fixtures: PromiseFixture[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function project(
  opts: Parameters<typeof promiseRegistry>[0] = {},
): PromiseFixture {
  const f = promiseRegistry({ production: true, ...opts });
  fixtures.push(f);
  return f;
}

/** Every source's chip for the one promise, as the page draws it. */
async function chips(
  f: PromiseFixture,
  src: ReturnType<typeof fakeSource>,
): Promise<{
  reads: SourceHealthRead[];
  chip: Record<string, HealthRow | undefined>;
}> {
  const reads = await readHealth(f.root, f.registry, src.deps);
  const chip: Record<string, HealthRow | undefined> = {};
  for (const r of reads) {
    chip[r.name] = healthRows(f.registry, r, ruleFor(r, reads))[PROMISE];
  }
  return { reads, chip };
}

function incident(status: "open" | "fixed") {
  return {
    id: "i-2026-10-05-checkout",
    promise: PROMISE,
    source: "deployed",
    status,
    opened: new Date(T0 - 2 * HOUR).toISOString(),
    traces: [TRACE],
    ...(status === "fixed"
      ? {
          fixed: new Date(T0 - HOUR).toISOString(),
          rootCause: "A retry charged twice.",
        }
      : {}),
  };
}

describe("the chips — test-kinds A4, A5, A10–A12", () => {
  it("A4: a production break reads red while its incident is open and purple once it is fixed", async () => {
    for (const [status, health] of [
      ["open", "red"],
      ["fixed", "fixed"],
    ] as const) {
      const f = project({ incidents: [incident(status)] });
      const src = fakeSource({ now: T0 });
      src.add("production", {
        promise: PROMISE,
        outcome: "violated",
        at: T0 - 2 * HOUR,
        traceId: TRACE,
      });
      const { chip } = await chips(f, src);
      expect(chip.production?.health, `incident ${status} — ${LESSON}`).toBe(
        health,
      );
    }
  });

  it("A5: local's chip, beside production, goes green once a newer local run holds, with no incident", async () => {
    const f = project();
    const src = fakeSource({ now: T0, sources: ["local", "production"] });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - HOUR,
    });
    src.add("local", {
      promise: PROMISE,
      outcome: "violated",
      at: T0 - 10 * MIN,
    });
    expect(
      (await chips(f, src)).chip.local?.health,
      "the newest local run broke",
    ).toBe("red");

    src.add("local", { promise: PROMISE, outcome: "upheld", at: T0 + 30_000 });
    src.clock.now += MIN; // past the health cache
    expect((await chips(f, src)).chip.local?.health, LESSON).toBe("green");
  });

  it("A10: an unreadable source's chip is hollow and says since when, never green; the other source is still drawn", async () => {
    const f = project();
    const src = fakeSource({ now: T0, sources: ["local", "production"] });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - HOUR,
    });
    src.add("local", { promise: PROMISE, outcome: "upheld", at: T0 - HOUR });
    const before = await chips(f, src);
    expect(before.chip.production?.health).toBe("green");

    src.fail("production");
    src.clock.now += MIN;
    const { reads, chip } = await chips(f, src);
    const production = reads.find((r) => r.name === "production");
    expect(production?.ok, "production is unknown").toBe(false);
    expect(
      production && !production.ok ? production.unknownSince : null,
      "since the last good read",
    ).toBe(new Date(T0).toISOString());
    expect(chip.production?.health, `never green — ${LESSON}`).not.toBe(
      "green",
    );
    expect(chip.local?.health, "local is still drawn").toBe("green");
  });

  it("A11: a blind watcher's source says watcher blind", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - HOUR,
    });
    src.blind("production");
    const { reads, chip } = await chips(f, src);
    const production = reads.find((r) => r.name === "production");
    expect(
      production && !production.ok ? production.blind : null,
      LESSON,
    ).toEqual({
      intake: "http://production.test:16686/otlp",
    });
    expect(chip.production?.health).not.toBe("green");
  });

  it("A12: a violated promise names the environment its newest violation came from", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "violated",
      at: T0 - 3 * HOUR,
      environment: "production",
    });
    src.add("production", {
      promise: PROMISE,
      outcome: "violated",
      at: T0 - HOUR,
      environment: "staging",
    });
    const { chip } = await chips(f, src);
    expect(chip.production?.health).toBe("red");
    expect(chip.production?.environment, LESSON).toBe("staging");
  });
});
