import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { openSection } from "@/__tests__/helpers/sections";
import { PlanDetail } from "./PlanDetail";

/**
 * promise: a-review-shows-its-evidence — admin-plan-authoring A16, on the plan page.
 *
 * A plan that skipped falsification or cleanup with its reason says so where
 * the ritual's section is — found in A27, where the page said "No
 * falsification ritual run" over a falsification that had hunted seven
 * hypotheses and recorded why it skipped, and showed no cleanup section at all.
 */
function plan(): Plan {
  return {
    name: "shout-flag",
    status: "completed",
    archived: false,
    impl: {
      frontmatter: { title: "shout-flag", status: "completed" },
      content:
        "## Checklist\n\n### Build Phase 1: Shout\n\n- [x] make it shout\n\n#### Build Phase 1 Verification\n\n- [x] tests pass\n",
      trajectory: { rows: [], deferred: [] },
    },
    skippedRituals: [
      { ritual: "falsification", reason: "hunted 7 hypotheses; none survived" },
      { ritual: "cleanup", reason: "two small files; nothing to decompose" },
    ],
  } as unknown as Plan;
}

describe("a skipped ritual is shown with its reason", () => {
  it("falsification says it was skipped and why, not that it never ran", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    await openSection(container, "falsification-section");
    const text =
      container.querySelector('[data-testid="falsification-section"]')
        ?.textContent ?? "";
    expect(text).toContain("Skipped: hunted 7 hypotheses; none survived");
    expect(text).not.toContain("No falsification ritual run");
  });

  it("cleanup has a section saying it was skipped and why", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    const section = container.querySelector('[data-testid="cleanup-skipped"]');
    expect(section?.textContent ?? "").toContain(
      "Skipped: two small files; nothing to decompose",
    );
  });
});
