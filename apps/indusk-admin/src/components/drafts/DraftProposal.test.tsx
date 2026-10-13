import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DraftProposal } from "./DraftProposal";

/**
 * promise: a-plan-can-start-from-the-admin — workbench-plan-authoring A9, moved
 * here from the New plan form when the name moved to the conversation's end.
 *
 * Accepting a proposal in a workbench that wraps more than one repo asks which
 * repo the plan's code goes in, and sends the choice with the accept; with one
 * repo, or in a normal-mode project, it asks nothing.
 *
 * promise: a-plan-starts-as-a-conversation — the proposal is accepted or
 * edited, and a name already taken is refused with another asked for.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
});

function capture(
  response: Response = Response.json({ plan: "seat-holds" }, { status: 201 }),
) {
  const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return response.clone();
    }),
  );
  return sent;
}

describe("A9 — accepting in a workbench asks which repo", () => {
  it("with two repos, the proposal asks, and the choice is sent", async () => {
    const sent = capture();
    const screen = await render(
      <DraftProposal
        project="concierge"
        draft="d1"
        proposal={{ name: "seat-holds", type: "feature" }}
        repos={["web", "api"]}
      />,
    );
    const repo = screen.getByLabelText("Repo");
    await expect.element(repo).toBeVisible();
    await userEvent.selectOptions(repo.element(), "api");
    await userEvent.click(
      screen.getByRole("button", { name: /accept/i }).element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe("/api/drafts/d1/accept");
    expect(sent[0]?.body).toMatchObject({
      project: "concierge",
      name: "seat-holds",
      type: "feature",
      repo: "api",
    });
  });

  it("with one repo, or none, nothing is asked and no repo is sent", async () => {
    const sent = capture();
    const screen = await render(
      <DraftProposal
        project="concierge"
        draft="d1"
        proposal={{ name: "seat-holds", type: "feature" }}
        repos={["web"]}
      />,
    );
    expect(screen.getByLabelText("Repo").elements()).toHaveLength(0);
    await userEvent.click(
      screen.getByRole("button", { name: /accept/i }).element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).not.toHaveProperty("repo");
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith("/p/concierge/plan/seat-holds/brief"),
    );
  });
});

describe("the proposal is the person's to accept or edit", () => {
  it("Edit opens the name and type, and the edited name is what is sent", async () => {
    const sent = capture();
    const screen = await render(
      <DraftProposal
        project="concierge"
        draft="d1"
        proposal={{ name: "seat-holds", type: "feature" }}
      />,
    );
    expect(screen.getByLabelText("Name").elements()).toHaveLength(0);
    await userEvent.click(
      screen.getByRole("button", { name: /edit/i }).element(),
    );
    await userEvent.fill(screen.getByLabelText("Name").element(), "seat-timer");
    await userEvent.click(
      screen.getByRole("button", { name: /accept/i }).element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toMatchObject({
      name: "seat-timer",
      type: "feature",
    });
    // let the move to the plan land here, not in the next test
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
  });

  it("a name already taken is shown as the refusal words it, with the name open to change", async () => {
    capture(
      Response.json(
        {
          error:
            "seat-holds is already started — choose another name for this draft",
        },
        { status: 409 },
      ),
    );
    const screen = await render(
      <DraftProposal
        project="concierge"
        draft="d1"
        proposal={{ name: "seat-holds", type: "feature" }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /accept/i }).element(),
    );
    await expect.element(screen.getByText(/choose another name/)).toBeVisible();
    await expect.element(screen.getByLabelText("Name")).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("A30 — a spike lands on the plan's page, not on a brief it never has", () => {
  it("a draft accepted as a spike moves to the plan page; a feature moves to its brief", async () => {
    capture(
      Response.json({ plan: "seat-study", type: "spike" }, { status: 201 }),
    );
    const spike = await render(
      <DraftProposal
        project="concierge"
        draft="d1"
        proposal={{ name: "seat-study", type: "spike" }}
      />,
    );
    await userEvent.click(
      spike.getByRole("button", { name: /accept/i }).element(),
    );
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/p/concierge/plan/seat-study");
    await spike.unmount();
    push.mockClear();

    capture(
      Response.json({ plan: "seat-holds", type: "feature" }, { status: 201 }),
    );
    const feature = await render(
      <DraftProposal
        project="concierge"
        draft="d2"
        proposal={{ name: "seat-holds", type: "feature" }}
      />,
    );
    await userEvent.click(
      feature.getByRole("button", { name: /accept/i }).element(),
    );
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    expect(push).toHaveBeenCalledWith("/p/concierge/plan/seat-holds/brief");
  });
});
