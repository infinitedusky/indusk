import "@/app/globals.css";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { TrustNotice } from "./TrustNotice";

/**
 * workbench-plan-authoring A25. In the live check the workbench was never
 * trusted, so every session ignored its allow-list and asked about
 * everything. A project Claude Code does not trust offers "Trust in Claude
 * Code"; the click is the person's consent, and the button is then gone.
 */

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => vi.unstubAllGlobals());

describe("A25 — the admin offers trust", () => {
  it("an untrusted project shows the button; a click trusts it and the button goes", async () => {
    const sent: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push({ url, body: JSON.parse(String(init.body)) });
        return Response.json({ trust: "trusted" });
      }),
    );
    const screen = await render(
      <TrustNotice project="numero" trusted={false} />,
    );
    const button = screen.getByRole("button", { name: "Trust in Claude Code" });
    await expect.element(button).toBeVisible();
    await userEvent.click(button.element());
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({ url: "/api/trust", body: { project: "numero" } });
    await vi.waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Trust in Claude Code" }).elements(),
      ).toHaveLength(0),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("a trusted project shows nothing", async () => {
    const screen = await render(
      <TrustNotice project="numero" trusted={true} />,
    );
    expect(
      screen.getByRole("button", { name: "Trust in Claude Code" }).elements(),
    ).toHaveLength(0);
  });
});
