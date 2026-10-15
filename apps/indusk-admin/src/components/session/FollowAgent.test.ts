import { describe, expect, it } from "vitest";
import { targetOf } from "./FollowAgent";

describe("FollowAgent — what the agent wrote, found on the brief page", () => {
  it("a mockup or a story is its look, a promise file its promise, the brief the brief", () => {
    const wt = "/w/dusk-worktrees/p";
    expect(
      targetOf(`${wt}/.indusk/mockups/admin/screens/plan.parts.html`),
    ).toBe('[data-look="plan.parts"]');
    expect(
      targetOf(`${wt}/.indusk/mockups/admin/components/chip.waiting.html`),
    ).toBe('[data-look="chip.waiting"]');
    expect(
      targetOf(`${wt}/.indusk/promises/a-plan-starts-as-a-conversation.md`),
    ).toBe('[data-promise="a-plan-starts-as-a-conversation"]');
    expect(targetOf(`${wt}/.indusk/planning/p/brief.md`)).toBe(
      '[data-document="brief"]',
    );
  });
  it("a file the page does not show is followed nowhere", () => {
    expect(targetOf("/w/apps/indusk-admin/src/x.tsx")).toBeNull();
    expect(targetOf("/w/.indusk/mockups/admin/components/chip.css")).toBeNull();
  });
});
