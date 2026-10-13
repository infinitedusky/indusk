import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DraftList } from "./DraftList";

/**
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 *
 * brief-as-the-contract, Build Phase 5: the project page lists the
 * conversations not kept, each reopened or discarded from its row.
 */

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

const DRAFTS = [
  { id: "d1", title: "phone nav", age: "last talked 2h ago", aged: false },
  { id: "d2", title: "rename sections", age: "untouched 12 days", aged: true },
];

describe("the drafts list", () => {
  it("lists each draft with its age", async () => {
    const screen = await render(<DraftList project="dusk" drafts={DRAFTS} />);
    await expect.element(screen.getByText("phone nav")).toBeVisible();
    await expect.element(screen.getByText("untouched 12 days")).toBeVisible();
    await expect
      .element(screen.getByText("2 conversations not kept"))
      .toBeVisible();
  });

  it("lists nothing when there are no drafts", async () => {
    const screen = await render(<DraftList project="dusk" drafts={[]} />);
    expect(screen.getByTestId("draft-list").elements()).toHaveLength(0);
  });

  it("Reopen moves to the draft's page", async () => {
    const screen = await render(<DraftList project="dusk" drafts={DRAFTS} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Reopen" }).first().element(),
    );
    expect(push).toHaveBeenCalledWith("/p/dusk/draft/d1");
  });

  it("Discard asks the admin to discard that draft, then refreshes the list", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return Response.json({ discarded: "d2" });
      }),
    );
    const screen = await render(<DraftList project="dusk" drafts={DRAFTS} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Discard" }).nth(1).element(),
    );
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(urls).toEqual(["/api/drafts/d2/discard"]);
  });
});
