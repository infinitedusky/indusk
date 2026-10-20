// clause: admin-pages-load-fast/never-freezes
import { beforeEach, describe, expect, it } from "vitest";
import { resetStandingKept, STALE_FOR_MS, standingKept } from "./standing-kept";

/** A reader that answers when the test lets it, so "the page did not wait" is observable. */
function slowReader() {
  const waiting: Array<(v: string) => void> = [];
  let calls = 0;
  return {
    read: () =>
      new Promise<string>((resolve) => {
        calls += 1;
        waiting.push(resolve);
      }),
    answer: (v: string) => waiting.shift()?.(v),
    calls: () => calls,
  };
}

describe("a page's standing, served while a newer one is read", () => {
  beforeEach(resetStandingKept);

  it("waits for the first read, then answers at once from it inside the window", async () => {
    const r = slowReader();
    let t = 1_000;
    const first = standingKept("p", r.read, () => t);
    r.answer("one");
    expect(await first).toBe("one");
    t += 3_000;
    expect(await standingKept("p", r.read, () => t)).toBe("one");
    expect(r.calls()).toBe(1);
  });

  it("past the kept window answers the last standing at once and refreshes once behind it", async () => {
    const r = slowReader();
    let t = 1_000;
    const first = standingKept("p", r.read, () => t);
    r.answer("one");
    await first;
    t += 10_000;
    expect(await standingKept("p", r.read, () => t)).toBe("one");
    expect(await standingKept("p", r.read, () => t)).toBe("one");
    expect(r.calls()).toBe(2); // one refresh, shared
    r.answer("two");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await standingKept("p", r.read, () => t)).toBe("two");
  });

  it("an answer older than the stale limit is waited for, and a failed read is not kept", async () => {
    let t = 1_000;
    let fail = false;
    const read = async () => {
      if (fail) throw new Error("jaeger answered 500");
      return "fine";
    };
    expect(await standingKept("p", read, () => t)).toBe("fine");
    fail = true;
    t += 10_000;
    expect(await standingKept("p", read, () => t)).toBe("fine"); // the refresh failing behind it is swallowed
    t += STALE_FOR_MS;
    await expect(standingKept("p", read, () => t)).rejects.toThrow(
      "jaeger answered 500",
    );
  });

  it("keeps each project's standing apart", async () => {
    const t = 1_000;
    expect(
      await standingKept(
        "a",
        async () => "A",
        () => t,
      ),
    ).toBe("A");
    expect(
      await standingKept(
        "b",
        async () => "B",
        () => t,
      ),
    ).toBe("B");
  });
});
