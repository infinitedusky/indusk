import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { NewPlanForm } from "./NewPlanForm";

/**
 * promise: a-plan-can-start-from-the-admin — workbench-plan-authoring A9.
 *
 * New plan in a workbench that wraps more than one repo asks which repo the
 * plan's code goes in, and sends the choice with the start; with one repo, or
 * in a normal-mode project, it asks nothing.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.unstubAllGlobals());

function capture() {
  const sent: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return Response.json({ plan: "seat-holds" }, { status: 201 });
    }),
  );
  return sent;
}

describe("A9 — New plan in a workbench asks which repo", () => {
  it("with two repos, the form asks, and the choice is sent", async () => {
    const sent = capture();
    const screen = await render(
      <NewPlanForm project="concierge" repos={["web", "api"]} />,
    );
    const repo = screen.getByLabelText("Repo");
    await expect.element(repo).toBeVisible();
    await userEvent.selectOptions(repo.element(), "api");
    await userEvent.fill(
      screen.getByPlaceholder("kebab-case-name").element(),
      "seat-holds",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /start/i }).element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      project: "concierge",
      name: "seat-holds",
      repo: "api",
    });
  });

  it("with one repo, or none, nothing is asked and no repo is sent", async () => {
    const sent = capture();
    const screen = await render(
      <NewPlanForm project="concierge" repos={["web"]} />,
    );
    expect(screen.getByLabelText("Repo").elements()).toHaveLength(0);
    await userEvent.fill(
      screen.getByPlaceholder("kebab-case-name").element(),
      "seat-holds",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /start/i }).element(),
    );
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).not.toHaveProperty("repo");
  });
});
