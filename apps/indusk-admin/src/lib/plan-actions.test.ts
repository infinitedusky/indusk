import { describe, expect, it } from "vitest";
import { planActions } from "./plan-actions";

/**
 * promise: a-plan-can-start-from-the-admin — workbench-plan-authoring A10.
 *
 * What a plan's page offers depends on where the plan stands, never on what
 * kind of project it is in. A normal-mode plan lives on its own branch, in
 * its worktree; a workbench plan lives at the workbench root with its code
 * named in `code.json`. Either one is "started", and gets the same buttons
 * at the same moments.
 */

const worktree = { path: "/p-worktrees/seats", branch: "plan/seats" };
const code = { repo: "web", branch: "plan/seats", worktree: "/wb/seats" };

describe("A10 — a workbench plan gets the buttons a normal-mode plan gets", () => {
  for (const [label, where] of [
    ["normal mode", { worktree }],
    ["workbench", { code }],
  ] as const) {
    it(`${label}: a plan being written offers Continue planning, then Approve once its impl exists`, () => {
      expect(planActions({ ...where })).toMatchObject({
        canPlan: true,
        canApprove: false,
        showBuild: false,
      });
      expect(planActions({ ...where, implStatus: "draft" })).toMatchObject({
        canPlan: true,
        canApprove: true,
      });
    });

    it(`${label}: an approved plan offers Build, and a plan in review offers Review`, () => {
      expect(planActions({ ...where, implStatus: "approved" })).toMatchObject({
        canPlan: false,
        canApprove: false,
        showBuild: true,
        canBuild: true,
        inReview: false,
      });
      expect(
        planActions({
          ...where,
          implStatus: "in-progress",
          position: "review",
        }),
      ).toMatchObject({
        showBuild: true,
        canBuild: false,
        inReview: true,
      });
    });
  }

  it("a plan that is neither on its own branch nor names its code offers nothing", () => {
    expect(planActions({ implStatus: "draft" })).toEqual({
      canPlan: false,
      canApprove: false,
      showBuild: false,
      canBuild: false,
      inReview: false,
    });
  });
});
