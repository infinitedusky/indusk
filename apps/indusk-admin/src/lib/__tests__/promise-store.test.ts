import { afterEach, describe, expect, it } from "vitest";
import { fakeSource } from "@/__tests__/helpers/fake-source";
import {
  PROMISE,
  type PromiseFixture,
  promiseRegistry,
} from "@/__tests__/helpers/promise-registry";
import { readTimelineView } from "@/lib/promise-timeline";

/**
 * test-kinds A6–A9 — the store's rules, with runs fed from a list and time
 * moved by the test (ADR D2). These replaced HTTP tests that booted `next dev`
 * and real Jaeger servers and slept to move time; each was seen red against
 * its rule broken in the source before its HTTP file went.
 */

const LESSON = "lesson: code-that-decides-takes-its-clock-and-its-reads";
const T0 = Date.parse("2026-10-05T12:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;

const fixtures: PromiseFixture[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

function project(): PromiseFixture {
  const f = promiseRegistry({ production: true });
  fixtures.push(f);
  return f;
}

async function view(f: PromiseFixture, src: ReturnType<typeof fakeSource>) {
  return readTimelineView(
    f.root,
    f.registry,
    {
      window: "24h",
      source: "production",
      sources: ["production"],
      timeoutMs: 2_000,
    },
    src.deps,
  );
}

function states(v: Awaited<ReturnType<typeof view>>): string[] {
  const strip = v.strips[PROMISE];
  return strip && strip !== "empty"
    ? strip.cells.filter((c) => c.runs > 0).map((c) => c.state)
    : [];
}

describe("the store — test-kinds A6–A9", () => {
  it("A6: a violation reaching Jaeger minutes after it happened still turns its cell red", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - HOUR,
    });
    expect(states(await view(f, src))).toEqual(["green"]);

    // Ended five minutes ago; reaches Jaeger only now.
    src.clock.now += MIN;
    src.add("production", {
      promise: PROMISE,
      outcome: "violated",
      at: T0 - 5 * MIN,
    });
    expect(states(await view(f, src)), LESSON).toContain("red");
  });

  it("A7: after the project is pointed at another server, nothing from the old one is drawn", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "violated",
      at: T0 - 2 * HOUR,
    });
    expect(states(await view(f, src)), "the first server's break").toContain(
      "red",
    );

    src.repoint("production", "http://other.test:16686");
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - 2 * HOUR,
    });
    src.clock.now += MIN;
    const after = states(await view(f, src));
    expect(after, "the second server's run").toContain("green");
    expect(after, LESSON).not.toContain("red");
  });

  it("A8: a window too slow for one refresh is drawn within a few, saying how far back it has read", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - 2 * HOUR,
    });
    src.slow(0, 5_000); // every read costs more than a refresh's 4 s budget: one slice per refresh

    const first = await view(f, src);
    expect(
      states(first),
      `the newest runs are drawn on the first refresh — ${LESSON}`,
    ).toEqual(["green"]);
    expect(first.reach, "it says how far back it has read").toMatch(
      /Read back to/,
    );

    let reach = first.reach;
    for (let i = 0; i < 20 && reach?.startsWith("Read back to"); i++) {
      src.clock.now += 5_000;
      reach = (await view(f, src)).reach;
    }
    expect(
      reach,
      "each refresh reads further, until the window is read",
    ).toBeNull();
  });

  it("A9: a refresh with nothing new asks only for the recent past", async () => {
    const f = project();
    const src = fakeSource({ now: T0 });
    src.add("production", {
      promise: PROMISE,
      outcome: "upheld",
      at: T0 - 3 * HOUR,
    });
    await view(f, src);
    const asked = src.ranges.length;

    src.clock.now += 30_000;
    await view(f, src);
    const again = src.ranges.slice(asked);
    expect(again.length, "one read for the refresh").toBe(1);
    expect(
      src.clock.now - again[0].from,
      `the refresh reads a tail of minutes, not the window — ${LESSON}`,
    ).toBeLessThanOrEqual(11 * MIN);
  });
});
