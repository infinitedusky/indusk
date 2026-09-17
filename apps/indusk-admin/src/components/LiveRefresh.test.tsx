import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ refresh }),
}));

import { LiveRefresh } from "./LiveRefresh";

/**
 * admin-ui-phase-progress — Build Phase 5's component test (the e2e rows
 * A14/A15 cover the real server; this covers the two states a server cannot
 * conveniently produce on demand): a failed probe stops the ticking and says
 * so; a hidden tab does not tick.
 */

const realFetch = globalThis.fetch;

beforeEach(() => {
  refresh.mockReset();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Object.defineProperty(document, "hidden", {
    value: false,
    configurable: true,
  });
});

describe("LiveRefresh", () => {
  it("ticks: probes the page, refreshes the router, and shows last updated", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    const { container } = await render(<LiveRefresh intervalMs={60} />);
    await new Promise((r) => setTimeout(r, 200));
    expect(refresh).toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="last-updated"]')?.textContent,
    ).toMatch(/last updated \d/);
  });

  it("a failed probe stops the ticking and says refresh failed", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const { container } = await render(<LiveRefresh intervalMs={60} />);
    await new Promise((r) => setTimeout(r, 200));
    expect(refresh).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="refresh-failed"]')?.textContent,
    ).toMatch(/refresh failed/i);
    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
      .length;
    await new Promise((r) => setTimeout(r, 200));
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
      "kept probing after a failure",
    ).toBe(calls);
  });

  it("a hidden tab does not tick", async () => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
    await render(<LiveRefresh intervalMs={60} />);
    await new Promise((r) => setTimeout(r, 200));
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
