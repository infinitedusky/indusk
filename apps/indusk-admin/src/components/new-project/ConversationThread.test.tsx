import "@/app/globals.css";
import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ConversationThread } from "./ConversationThread";

// promise: a-project-conversation-is-a-back-and-forth

/**
 * new-project-flow A24, A25: an agent reply in Markdown shows formatted with
 * its working folded behind See more; a question or permission the agent
 * waits on is never folded away.
 */

const worked: StartedEvent[] = [
  { type: "tool", name: "Read", input: { file_path: "planner.md" } },
  { type: "text", text: "Reading the brief." },
  { type: "text", text: "Your brief answers **why** and **what**." },
  {
    type: "result",
    ok: true,
    subtype: "success",
    text: "Your brief answers **why** and **what**.",
    sessionId: "s",
  },
];

const noop = () => {};
const thread = (events: StartedEvent[], running = true) => (
  <ConversationThread
    events={events}
    running={running}
    onAnswer={noop}
    onDecide={noop}
    onSay={noop}
  />
);

describe("A24 — a reply is formatted and its working is folded", () => {
  it("A24 shows the reply as formatted Markdown with the working hidden until See more, and See less hides it again", async () => {
    const screen = await render(thread(worked, false));
    const strong = screen.container.querySelector("strong");
    expect(strong?.textContent).toBe("why");
    expect(screen.container.textContent).not.toContain("**");
    expect(screen.container.textContent).not.toContain("Read planner.md");

    await userEvent.click(
      screen.getByRole("button", { name: /see more/i }).element(),
    );
    await expect.element(screen.getByText("Read planner.md")).toBeVisible();
    await expect.element(screen.getByText("Reading the brief.")).toBeVisible();

    await userEvent.click(
      screen.getByRole("button", { name: /see less/i }).element(),
    );
    expect(screen.container.textContent).not.toContain("Read planner.md");
  });

  it("A24 tells the page when See more is used", async () => {
    const opened = vi.fn();
    const screen = await render(
      <ConversationThread
        events={worked}
        running={false}
        onAnswer={noop}
        onDecide={noop}
        onFoldOpened={opened}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /see more/i }).element(),
    );
    expect(opened).toHaveBeenCalledTimes(1);
  });
});

describe("A25 — what the agent waits on is never folded", () => {
  it("A25 shows an open question and a permission request without opening anything", async () => {
    const screen = await render(
      thread([
        { type: "tool", name: "Read", input: { file_path: "planner.md" } },
        {
          type: "question",
          requestId: "q1",
          questions: [
            { question: "Where should it run?", options: [{ label: "Fly" }] },
          ],
          input: {},
        },
        {
          type: "permission",
          requestId: "p1",
          tool: "Write",
          input: { file_path: "/x/y.md" },
        },
      ]),
    );
    await expect
      .element(screen.getByText("Where should it run?"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Allow" }))
      .toBeVisible();
    expect(screen.container.textContent).not.toContain("Read planner.md");
  });

  it("A25 sends the person's answer back through onAnswer", async () => {
    const answered = vi.fn();
    const screen = await render(
      <ConversationThread
        events={[
          {
            type: "question",
            requestId: "q1",
            questions: [{ question: "Where?", options: [{ label: "Fly" }] }],
            input: {},
          },
        ]}
        running
        onAnswer={answered}
        onDecide={noop}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Fly/ }).element(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Answer", exact: true }).element(),
    );
    expect(answered).toHaveBeenCalledWith("q1", { "Where?": "Fly" });
  });
});

describe("the reply box sends what was typed, once", () => {
  const box = (onSay: (text: string) => void, onStop = noop) => (
    <ConversationThread
      events={worked}
      running
      onAnswer={noop}
      onDecide={noop}
      onSay={onSay}
      onStop={onStop}
    />
  );

  it("Enter sends; Shift+Enter is a new line", async () => {
    const onSay = vi.fn();
    const screen = await render(box(onSay));
    const reply = screen.getByRole("textbox", { name: /reply to the agent/i });
    await userEvent.type(reply, "this is{Shift>}{Enter}{/Shift}a test{Enter}");
    expect(onSay).toHaveBeenCalledExactlyOnceWith("this is\na test");
    await expect.element(reply).toHaveValue("");
  });

  it("Stop stops and sends nothing", async () => {
    const onSay = vi.fn();
    const onStop = vi.fn();
    const screen = await render(box(onSay, onStop));
    await userEvent.type(
      screen.getByRole("textbox", { name: /reply to the agent/i }),
      "half a thought",
    );
    await screen.getByRole("button", { name: "Stop" }).click();
    expect(onStop).toHaveBeenCalledOnce();
    expect(onSay).not.toHaveBeenCalled();
  });
});
