import "@/app/globals.css";
import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { SessionPanel } from "./SessionPanel";

/**
 * promise: a-session-says-how-it-ended — small-fixes A7, A8.
 *
 * The panel printed Claude Code's own status word (`success`) beside an API
 * error, and "Ended" when only the turn ended (known-issues, "Ended: success"
 * on a failed turn, 2026-10-06). It says what happened instead: a turn
 * failed, with the error's first line; a turn finished; the session ended,
 * with its exit code.
 */

const init: StartedEvent = {
  type: "init",
  sessionId: "s",
  model: "sonnet",
  version: "2.1.197",
  cwd: "/w",
};

async function textOf(events: StartedEvent[], running = true) {
  const r = render(
    <SessionPanel
      events={events}
      running={running}
      onAnswer={vi.fn()}
      onDecide={vi.fn()}
      onStop={vi.fn()}
    />,
  );
  return (await r).container.textContent ?? "";
}

describe("A7 — a turn that ends with an API error says Failed, never success", () => {
  it("shows Failed with the error's first line, and the word success nowhere", async () => {
    const text = await textOf([
      init,
      {
        type: "result",
        ok: false,
        subtype: "success",
        text: "API Error: Server is temporarily limiting requests\nThe response may be incomplete.",
      },
    ]);
    expect(text).toMatch(/Failed/);
    expect(text).toContain(
      "API Error: Server is temporarily limiting requests",
    );
    expect(text).not.toMatch(/success/i);
    expect(text).not.toMatch(/Ended/);
  });
});

/**
 * A22 (falsification): Claude Code's `error_max_turns` and
 * `error_during_execution` results carry no `result` text, so the panel said
 * only "Failed" — the promise says with the reason.
 */
describe("A22 — a failed turn with no text still says why, in words", () => {
  for (const [subtype, why] of [
    ["error_max_turns", /turn limit/i],
    ["error_during_execution", /error/i],
    ["error_something_new", /\S/],
  ] as const) {
    it(`${subtype}: Failed with a reason, never the raw subtype`, async () => {
      const text = await textOf([
        init,
        { type: "result", ok: false, subtype, text: "" },
      ]);
      expect(text).toMatch(/Failed — /);
      const reason = text.split("Failed — ")[1] ?? "";
      expect(reason).toMatch(why);
      expect(text).not.toContain(subtype);
    });
  }
});

describe("A8 — a finished turn and an ended session are told apart", () => {
  it("a completed turn says Turn done, not Ended", async () => {
    const text = await textOf([
      init,
      { type: "result", ok: true, subtype: "success", text: "" },
    ]);
    expect(text).toMatch(/Turn done/);
    expect(text).not.toMatch(/Ended/);
  });

  it("only an exited process says Session ended, with its code", async () => {
    const text = await textOf(
      [
        init,
        { type: "result", ok: true, subtype: "success", text: "" },
        { type: "exit", code: 1, stderr: "" },
      ],
      false,
    );
    expect(text).toMatch(/Session ended/);
    expect(text).toMatch(/code 1/);
  });
});
