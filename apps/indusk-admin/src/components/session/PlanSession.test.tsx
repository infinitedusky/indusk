import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("./SessionConnector", () => ({
  SessionConnector: ({ sessionId }: { sessionId: string }) => (
    <p data-testid="connected">{sessionId}</p>
  ),
}));

import { PlanSession } from "./PlanSession";

/**
 * The Start control waits for the running session to be looked up: shown
 * before the lookup answers, it invited a click that was refused with "a
 * session is already running" over a session the page was about to reattach.
 */
const lookup = (session: unknown) => {
  let answer: (v: unknown) => void = () => {};
  const pending = new Promise((r) => {
    answer = r;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      await pending;
      return { json: async () => ({ session }) };
    }),
  );
  return () => answer(undefined);
};

const show = () =>
  render(<PlanSession project="dusk" plan="p" canApprove={false} canPlan />);

afterEach(() => vi.unstubAllGlobals());

describe("PlanSession — Start waits for the session lookup", () => {
  it("offers no Start before the lookup answers, then offers it when no session runs", async () => {
    const answer = lookup(null);
    const screen = await show();
    expect(screen.container.textContent).not.toContain("Talk to the agent");
    expect(screen.container.textContent).toContain("Connecting");
    answer();
    await vi.waitFor(() =>
      expect(screen.container.textContent).toContain("Talk to the agent"),
    );
    expect(screen.container.textContent).not.toContain("Connecting");
  });

  it("attaches to this plan's running session and never offers Start", async () => {
    const answer = lookup({
      id: "s1",
      project: "dusk",
      plan: "p",
      kind: "planning",
    });
    const screen = await show();
    answer();
    await vi.waitFor(() =>
      expect(screen.container.textContent).toContain("s1"),
    );
    expect(screen.container.textContent).not.toContain("Talk to the agent");
  });

  it("offers Start when the lookup fails, rather than nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("down");
      }),
    );
    const screen = await show();
    await vi.waitFor(() =>
      expect(screen.container.textContent).toContain("Talk to the agent"),
    );
  });
});
