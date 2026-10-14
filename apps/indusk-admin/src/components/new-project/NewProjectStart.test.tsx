import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { NewProjectConversation } from "./NewProjectConversation";
import { NewProjectStart } from "./NewProjectStart";

// promise: a-project-starts-as-a-conversation

/**
 * new-project-flow A1: New project opens a page with only the "What do you want
 * to build?" box and a way to add documents - no field to fill first, and no
 * project needed.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

describe("A1 — New project asks only what you want to build", () => {
  it("A1 shows the question, one box and a way to add documents, and needs no project", async () => {
    const screen = await render(<NewProjectStart />);
    await expect
      .element(
        screen.getByRole("heading", { name: "What do you want to build?" }),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: /add documents/i }))
      .toBeInTheDocument();
    expect(screen.getByRole("textbox").elements()).toHaveLength(1);
  });
});

/**
 * new-project-flow A28: Start starts the agent. The one request Start sends
 * is the create route (which launches the draft's session as it creates the
 * draft), and the conversation it opens shows the agent working - there is no
 * "Talk to the agent" button to press.
 */
describe("A28 — Start launches the agent", () => {
  it("A28 sends one request, to the create route, and moves to the conversation", async () => {
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        sent.push(url);
        return Response.json({ id: "d1" }, { status: 201 });
      }),
    );
    const screen = await render(<NewProjectStart />);
    await userEvent.type(screen.getByRole("textbox"), "A homework gate");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/new/d1"));
    expect(sent).toEqual(["/api/new-projects"]);
  });

  it("A28 the conversation it opens has the agent working, with no second click", async () => {
    vi.stubGlobal(
      "EventSource",
      class {
        onmessage: unknown;
        onerror: unknown;
        close() {}
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ session: null })),
    );
    const screen = await render(
      <NewProjectConversation
        draft="d1"
        sessionPlan="new-project:d1"
        message="A homework gate"
        documents={[]}
        knowledge={[]}
        hasContent={false}
        session="s1"
      />,
    );
    await expect.element(screen.getByText("Working…")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /talk to the agent/i }).elements(),
    ).toHaveLength(0);
  });
});
