import { describe, expect, it } from "vitest";
import {
  applyEvent,
  type CreationView,
  parseLines,
  readCreation,
} from "./creation-stream";

// promise: a-new-project-is-made-by-the-agent

/** new-project-flow A5, the page half: how the steps the route streams become what the page draws. */

const start: CreationView = {
  steps: [
    { id: "workbench", state: "waiting" },
    { id: "repository", state: "waiting" },
  ],
  href: null,
  problem: null,
};

describe("A5 — the streamed steps become the page", () => {
  it("A5 moves one step at a time and ends with the way in", () => {
    let view = applyEvent(start, {
      type: "step",
      id: "workbench",
      state: "working",
    });
    expect(view.steps.map((s) => s.state)).toEqual(["working", "waiting"]);
    view = applyEvent(view, { type: "step", id: "workbench", state: "done" });
    view = applyEvent(view, {
      type: "done",
      name: "hg",
      href: "/p/hg/",
    });
    expect(view.href).toBe("/p/hg/");
    expect(view.problem).toBeNull();
  });

  it("A5 keeps the project's way in and says when only the remote failed", () => {
    const view = applyEvent(start, {
      type: "done",
      name: "hg",
      href: "/p/hg/",
      remoteError: "gh: not signed in",
    });
    expect(view.href).toBe("/p/hg/");
    expect(view.problem).toContain("gh: not signed in");
  });

  it("A5 holds a line that arrives in pieces until it is whole", () => {
    const whole = `${JSON.stringify({ type: "error", message: "boom" })}\n`;
    const first = parseLines(whole.slice(0, 10));
    expect(first.events).toEqual([]);
    const second = parseLines(first.rest + whole.slice(10));
    expect(second.events).toEqual([{ type: "error", message: "boom" }]);
  });

  it("A5 reads a whole answer, and a refusal as its reason", async () => {
    const seen: unknown[] = [];
    await readCreation(
      new Response(
        `${JSON.stringify({ type: "step", id: "install", state: "done" })}\n`,
      ),
      (e) => seen.push(e),
    );
    expect(seen).toEqual([{ type: "step", id: "install", state: "done" }]);
    const refused: unknown[] = [];
    await readCreation(
      Response.json({ error: "no such conversation" }, { status: 404 }),
      (e) => refused.push(e),
    );
    expect(refused).toEqual([
      { type: "error", message: "no such conversation" },
    ]);
  });
});
