import { afterEach, describe, expect, it, vi } from "vitest";
import { postJson } from "./post-json";

/**
 * promise: one-definition-per-shared-rule — admin-plan-authoring A39.
 *
 * Every panel that asks the admin to do something posts JSON and, when the
 * admin refuses, shows why: its `{ error }`, else the status, else why the
 * request never arrived. One function says how.
 */

afterEach(() => vi.unstubAllGlobals());

function answer(status: number, body: unknown) {
  const fetch = vi.fn(async () =>
    typeof body === "string"
      ? new Response(body, { status })
      : Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("A39 — a panel's request to the admin", () => {
  it("posts the body as JSON and gives back the server's body on success", async () => {
    const fetch = answer(201, { id: "s1" });
    expect(await postJson("/api/sessions", { plan: "seats" })).toEqual({
      ok: true,
      body: { id: "s1" },
    });
    expect(fetch).toHaveBeenCalledWith("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "seats" }),
    });
  });

  it("gives back the server's error when it refuses", async () => {
    answer(409, { error: "a session is already running" });
    expect(await postJson("/api/sessions", {})).toEqual({
      ok: false,
      error: "a session is already running",
    });
  });

  it("gives back the status when the refusal carries no error", async () => {
    answer(500, "not json");
    expect(await postJson("/api/sessions", {})).toEqual({
      ok: false,
      error: "HTTP 500",
    });
  });

  it("gives back why the request failed when it never arrived", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    expect(await postJson("/api/sessions", {})).toEqual({
      ok: false,
      error: "fetch failed",
    });
  });
});
