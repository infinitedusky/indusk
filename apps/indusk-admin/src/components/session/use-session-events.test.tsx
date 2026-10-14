import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { useSessionEvents } from "./use-session-events";

/**
 * promise: a-project-conversation-is-a-back-and-forth
 *
 * A34: a running agent's events reach the plan conversation and the project
 * conversation through one subscription.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));

class FakeSource {
  static all: FakeSource[] = [];
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSource.all.push(this);
  }
  close() {
    this.closed = true;
  }
  emit(ev: object) {
    this.onmessage?.({ data: JSON.stringify(ev) });
  }
}

beforeEach(() => {
  FakeSource.all = [];
  refresh.mockClear();
  vi.stubGlobal("EventSource", FakeSource);
});
afterEach(() => vi.unstubAllGlobals());

function Probe({ onWrite }: { onWrite: (ev: unknown) => void }) {
  const { events, running } = useSessionEvents("s1", { onWrite });
  return (
    <p>
      {running ? "running" : "stopped"} {events.length}
    </p>
  );
}

describe("A34 useSessionEvents", () => {
  it("a file the agent writes refreshes the page and reports the write; the agent ending stops it listening", async () => {
    const onWrite = vi.fn();
    const screen = await render(<Probe onWrite={onWrite} />);
    const source = FakeSource.all[0];
    expect(source.url).toBe("/api/sessions/s1/events");

    source.emit({ type: "tool", name: "Read", input: { file_path: "/a" } });
    expect(refresh).not.toHaveBeenCalled();

    source.emit({ type: "tool", name: "Write", input: { file_path: "/a.md" } });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onWrite).toHaveBeenCalledTimes(1);

    source.emit({ type: "exit" });
    await expect.element(screen.getByText(/stopped 3/)).toBeVisible();
    expect(source.closed).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("an error stops it listening", async () => {
    const screen = await render(<Probe onWrite={vi.fn()} />);
    const source = FakeSource.all[0];
    source.onerror?.();
    await expect.element(screen.getByText(/stopped/)).toBeVisible();
    expect(source.closed).toBe(true);
  });
});
