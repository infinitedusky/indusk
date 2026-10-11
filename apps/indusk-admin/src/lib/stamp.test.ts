// promise: display-names-are-defined-once

import { describe, expect, it } from "vitest";
import { stamp } from "./stamp";

/**
 * plan-cockpit A43: one `stamp` turns an ISO time into `YYYY-MM-DD HH:MM`
 * (UTC), so a time reads the same on the dashboard, a promise's page, a plan's
 * history and the timeline.
 */

describe("A43 — one stamp for a time", () => {
  it("reads an ISO time as date, space, hours and minutes", () => {
    expect(stamp("2026-10-10T08:05:33.000Z")).toBe("2026-10-10 08:05");
  });

  it("reads a time with no seconds the same way", () => {
    expect(stamp("2026-10-10T08:05Z")).toBe("2026-10-10 08:05");
  });
});
