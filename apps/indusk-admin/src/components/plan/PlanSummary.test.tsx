import "@/app/globals.css";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { PlanSummary } from "./PlanSummary";

/**
 * brief-as-the-contract A28 — "The brief is incomplete" is the current step
 * only while the brief is unfinished by the rail's own rule.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */

const show = (briefStatus: string | null, archived = false) =>
  render(
    <PlanSummary
      description="Seats are held."
      briefStatus={briefStatus}
      briefHref="/b"
      archived={archived}
    />,
  );

describe("A28 — the incomplete brief is shown only for an unfinished brief", () => {
  it("a draft or proposed brief shows the current step", async () => {
    for (const status of ["draft", "proposed", null]) {
      const screen = await show(status);
      await expect
        .element(screen.getByTestId("brief-incomplete"))
        .toBeVisible();
      await screen.unmount();
    }
  });

  it.each(["accepted", "complete", "superseded"])(
    "a %s brief shows no incomplete step",
    async (status) => {
      const screen = await show(status);
      expect(screen.getByTestId("brief-incomplete").elements()).toHaveLength(0);
    },
  );

  it("an archived plan shows no incomplete step whatever its brief says", async () => {
    const screen = await show("draft", true);
    expect(screen.getByTestId("brief-incomplete").elements()).toHaveLength(0);
  });
});
