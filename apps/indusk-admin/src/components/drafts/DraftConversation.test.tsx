import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DraftConversation } from "./DraftConversation";

/**
 * promise: a-plan-starts-as-a-conversation
 *
 * brief-as-the-contract, Build Phase 5: a draft's page offers a box to tell
 * the agent what you want and asks for no name or type; talking posts the
 * person's words to the draft's own conversation.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

describe("a draft's conversation", () => {
  it("asks only what you want, and posts it to the draft's talk route", async () => {
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.startsWith("/api/sessions?"))
          return Response.json({ session: null });
        sent.push({ url, body: JSON.parse(String(init?.body)) });
        return Response.json({ id: "s1" }, { status: 201 });
      }),
    );
    const screen = await render(
      <DraftConversation
        project="dusk"
        draft="d1"
        sessionPlan="draft:d1"
        hasContent={false}
      />,
    );
    expect(screen.getByLabelText("Name").elements()).toHaveLength(0);
    expect(screen.getByLabelText("Type").elements()).toHaveLength(0);
    const talk = screen.getByRole("button", { name: /talk to the agent/i });
    await expect.element(talk).toBeDisabled();
    await userEvent.fill(
      screen.getByLabelText("Tell the agent what you want").element(),
      "a nav that opens on a phone",
    );
    await userEvent.click(talk.element());
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      url: "/api/drafts/d1/talk",
      body: {
        project: "dusk",
        text: "a nav that opens on a phone",
        reopened: false,
      },
    });
  });

  it("a draft that holds something is reopened without being made to type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ session: null })),
    );
    const screen = await render(
      <DraftConversation
        project="dusk"
        draft="d1"
        sessionPlan="draft:d1"
        hasContent
      />,
    );
    await expect
      .element(screen.getByRole("button", { name: /reopen the conversation/i }))
      .toBeEnabled();
  });
});
