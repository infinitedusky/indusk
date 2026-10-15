import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useAnsweredRequests } from "./use-answered-requests";

// promise: a-prompt-shows-only-when-a-person-must-choose

/**
 * A11: a click closes its request at once; a reply the server refuses
 * reopens it, and an accepted one keeps it closed.
 */

const later = <T,>(value: T) => Promise.resolve(value);

describe("A11 useAnsweredRequests", () => {
  it("a settled request is answered at once, before its reply resolves", async () => {
    const { result, act } = await renderHook(() => useAnsweredRequests());
    let release: (accepted: boolean) => void = () => {};
    await act(() => {
      result.current.settle(
        "r1",
        new Promise<boolean>((resolve) => {
          release = resolve;
        }),
      );
    });
    expect(result.current.answered.has("r1")).toBe(true);
    await act(async () => {
      release(true);
      await later(null);
    });
  });

  it("a reply resolving false reopens the request", async () => {
    const { result, act } = await renderHook(() => useAnsweredRequests());
    await act(async () => {
      result.current.settle("r1", later(false));
      await later(null);
      await later(null);
    });
    expect(result.current.answered.has("r1")).toBe(false);
  });

  it("a reply resolving true, or nothing, keeps it closed", async () => {
    const { result, act } = await renderHook(() => useAnsweredRequests());
    await act(async () => {
      result.current.settle("r1", later(true));
      result.current.settle("r2", undefined);
      await later(null);
      await later(null);
    });
    expect(result.current.answered.has("r1")).toBe(true);
    expect(result.current.answered.has("r2")).toBe(true);
  });
});
