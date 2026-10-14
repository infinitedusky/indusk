import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { NewProjectConversation } from "./NewProjectConversation";

// promise: a-project-starts-as-a-conversation

/**
 * new-project-flow, Build Phase 1: a project conversation shows the person's
 * words and documents and what the agent knows; a conversation whose session
 * has ended is started again through the draft's talk route, and Discard
 * removes the draft through its discard route.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

const props = {
  draft: "d1",
  sessionPlan: "new-project:d1",
  message: "A parental control system",
  documents: ["brief.md"],
  knowledge: [
    { label: "Why — goals", state: "settled" as const },
    { label: "Name and place", state: "open" as const },
  ],
};

describe("a project conversation", () => {
  it("shows the first message, its documents and what the agent knows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ session: null })),
    );
    const screen = await render(
      <NewProjectConversation {...props} hasContent={false} />,
    );
    await expect
      .element(screen.getByText("A parental control system"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("brief.md")).toBeInTheDocument();
    await expect
      .element(screen.getByText("What the agent knows"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Why — goals")).toBeInTheDocument();
  });

  it("starts the conversation again through the draft's talk route, reopened when it holds something", async () => {
    const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === "/api/sessions") return Response.json({ session: null });
        if (url.startsWith("/api/sessions/"))
          return new Response("", { status: 200 });
        sent.push({ url, body: JSON.parse(String(init?.body)) });
        return Response.json({ id: "s1" }, { status: 201 });
      }),
    );
    const screen = await render(
      <NewProjectConversation {...props} hasContent />,
    );
    await userEvent.click(
      screen
        .getByRole("button", { name: /reopen the conversation/i })
        .element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      url: "/api/new-projects/d1/talk",
      body: { reopened: true },
    });
  });

  it("discards the draft through its discard route", async () => {
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/sessions") return Response.json({ session: null });
        sent.push(url);
        return Response.json({ discarded: "d1" });
      }),
    );
    const screen = await render(
      <NewProjectConversation {...props} hasContent={false} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Discard" }).element(),
    );
    await vi.waitFor(() =>
      expect(sent).toEqual(["/api/new-projects/d1/discard"]),
    );
  });
});
