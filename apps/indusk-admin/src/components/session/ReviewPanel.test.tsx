import type { Review } from "@infinitedusky/indusk-mcp/build";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { ReviewPanel } from "./ReviewPanel";

/**
 * promise: a-review-shows-its-evidence — admin-plan-authoring A15, A16, A17, the panel's half.
 *
 * The review the package assembles reaches the person whole: a proven
 * promise with its rows, an unproven one with why, what falsification found
 * and fixed, the files, and every skip with its reason.
 */
const review: Review = {
  plan: "seats",
  promises: [
    {
      name: "seat-released-on-timeout",
      proven: true,
      rows: [{ id: "A1", state: "passing", tests: ["t.ts"] }],
      why: null,
    },
    {
      name: "seat-never-double-held",
      proven: false,
      rows: [{ id: "A2", state: "written", tests: [] }],
      why: "row A2 is written",
    },
  ],
  falsification: [
    {
      phase: "Build Phase 2: Falsification — holds that never expire",
      rows: [
        {
          id: "A3",
          asserts: "a hold whose clock goes backwards still expires",
          state: "passing",
        },
      ],
      items: [{ text: "read the expiry from a monotonic clock", done: true }],
    },
  ],
  files: [{ path: "src/seat.ts", status: "A" }],
  skippedRituals: [
    { ritual: "cleanup", reason: "one small file; nothing to decompose" },
  ],
  skips: [
    {
      phase: "Build Phase 1: Seats",
      gate: "document",
      item: "(none needed — no public page yet)",
    },
  ],
};

describe("the review panel shows the evidence", () => {
  it("promises proven and unproven, falsification, files and skips", async () => {
    const text =
      (await render(<ReviewPanel review={review} />)).container.textContent ??
      "";
    expect(text).toContain("seat-released-on-timeout — proven by A1");
    expect(text).toContain(
      "seat-never-double-held — unproven: row A2 is written",
    );
    expect(text).toContain("a hold whose clock goes backwards still expires");
    expect(text).toContain("Fixed: read the expiry from a monotonic clock");
    expect(text).toContain("src/seat.ts");
    expect(text).toContain("(none needed — no public page yet)");
    expect(text).toContain(
      "Cleanup skipped: one small file; nothing to decompose",
    );
  });
});
