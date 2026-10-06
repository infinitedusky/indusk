import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { SessionPanel } from "./SessionPanel";

/**
 * promise: a-plan-can-start-from-the-admin — admin-plan-authoring A1, A2, A3, the panel's half.
 * promise: a-session-can-be-stopped — admin-plan-authoring A21, the panel's half.
 *
 * What the session says appears as it says it; a question shows its choices
 * and the chosen answer goes back; a request to use a tool can be allowed or
 * denied; Stop ends it. The panel is handed the session's events and reports
 * the person's choices — it never parses Claude's protocol (the package's
 * `protocol.ts` does). Every assertion reads what a person sees or clicks.
 */

const init: StartedEvent = {
  type: "init",
  sessionId: "s",
  model: "sonnet",
  version: "2.1.197",
  cwd: "/w",
};
const question: StartedEvent = {
  type: "question",
  requestId: "q1",
  input: {},
  questions: [
    {
      question: "Which workflow?",
      header: "Workflow",
      options: [
        { label: "feature", description: "the full lifecycle" },
        { label: "bugfix", description: "brief, test plan, impl" },
      ],
    },
  ],
};
const permission: StartedEvent = {
  type: "permission",
  requestId: "p1",
  tool: "Write",
  input: { file_path: "/w/.indusk/planning/seats/brief.md" },
};

function panel(
  events: StartedEvent[],
  over: Partial<Parameters<typeof SessionPanel>[0]> = {},
) {
  const handlers = { onAnswer: vi.fn(), onDecide: vi.fn(), onStop: vi.fn() };
  return {
    handlers,
    rendered: render(
      <SessionPanel events={events} running {...handlers} {...over} />,
    ),
  };
}

const textOf = async (r: ReturnType<typeof render>) =>
  (await r).container.textContent ?? "";
const button = async (r: ReturnType<typeof render>, label: string) =>
  // A button's text, or an option's label (its first span; the description follows it).
  [...(await r).container.querySelectorAll("button")].find(
    (b) =>
      b.textContent?.trim() === label ||
      b.querySelector("span")?.textContent === label,
  ) as HTMLButtonElement | undefined;

describe("A1 — what the session says appears in the panel", () => {
  it("its text and the tools it uses, in order", async () => {
    const { rendered } = panel([
      init,
      { type: "text", text: "Let me read the master plan first." },
      {
        type: "tool",
        name: "Read",
        input: { file_path: "/w/.indusk/planning/master.md" },
      },
      { type: "text", text: "Two questions before I write the brief." },
    ]);
    const text = await textOf(rendered);
    expect(text.indexOf("Let me read the master plan first.")).toBeLessThan(
      text.indexOf("master.md"),
    );
    expect(text.indexOf("master.md")).toBeLessThan(
      text.indexOf("Two questions before I write the brief."),
    );
  });

  it("an untrusted worktree is said in words, and so is a trusted one", async () => {
    expect(
      await textOf(panel([{ type: "untrusted", cwd: "/w" }]).rendered),
    ).toMatch(/not trusted/i);
    expect(
      await textOf(panel([{ type: "trusted", cwd: "/w" }]).rendered),
    ).toMatch(/trusted/i);
  });
});

describe("A2 — a question shows its choices; the chosen answer goes back", () => {
  it("each option is shown with its description", async () => {
    const text = await textOf(panel([init, question]).rendered);
    expect(text).toContain("Which workflow?");
    expect(text).toContain("feature");
    expect(text).toContain("brief, test plan, impl");
  });

  it("choosing an option and answering sends question → label", async () => {
    const { rendered, handlers } = panel([init, question]);
    (await button(rendered, "bugfix"))?.click();
    (await button(rendered, "Answer"))?.click();
    await vi.waitFor(() =>
      expect(handlers.onAnswer).toHaveBeenCalledWith("q1", {
        "Which workflow?": "bugfix",
      }),
    );
  });

  it("an answered question is not asked again", async () => {
    const { rendered, handlers } = panel([init, question]);
    (await button(rendered, "feature"))?.click();
    (await button(rendered, "Answer"))?.click();
    await vi.waitFor(() => expect(handlers.onAnswer).toHaveBeenCalled());
    await vi.waitFor(async () =>
      expect(await button(rendered, "Answer")).toBeUndefined(),
    );
  });
});

describe("A3 — a request to use a tool can be allowed or denied", () => {
  it("names the tool and what it would touch", async () => {
    const text = await textOf(panel([init, permission]).rendered);
    expect(text).toContain("Write");
    expect(text).toContain(".indusk/planning/seats/brief.md");
  });

  it("Allow sends allow; Deny sends no", async () => {
    const allowing = panel([init, permission]);
    (await button(allowing.rendered, "Allow"))?.click();
    await vi.waitFor(() =>
      expect(allowing.handlers.onDecide).toHaveBeenCalledWith("p1", true),
    );
    const denying = panel([init, permission]);
    (await button(denying.rendered, "Deny"))?.click();
    await vi.waitFor(() =>
      expect(denying.handlers.onDecide).toHaveBeenCalledWith("p1", false),
    );
  });
});

describe("A21 — the session can be stopped from the panel", () => {
  it("Stop stops a running session", async () => {
    const { rendered, handlers } = panel([init]);
    (await button(rendered, "Stop"))?.click();
    await vi.waitFor(() => expect(handlers.onStop).toHaveBeenCalled());
  });

  it("a session that has ended offers no Stop, and says how it ended", async () => {
    const { rendered } = panel(
      [
        init,
        {
          type: "result",
          ok: true,
          subtype: "success",
          text: "Brief written.",
          sessionId: "s",
        },
        { type: "exit", code: 0, stderr: "" },
      ],
      { running: false },
    );
    expect(await button(rendered, "Stop")).toBeUndefined();
    expect(await textOf(rendered)).toContain("Brief written.");
  });
});
