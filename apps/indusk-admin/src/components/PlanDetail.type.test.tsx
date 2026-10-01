import {
  PLAN_POSITIONS,
  type PlanPosition,
  type PlanPositionState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

// PlanDetail imports next/link — stubbed like every other browser test.
vi.mock("next/link", () => {
  function MockLink({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return { default: MockLink, __esModule: true };
});

import { PlanDetail } from "./PlanDetail";

beforeEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
});

/**
 * admin-plan-type — A1, A2, A3, A4, A10.
 *
 * The plan page says what kind of plan it is, explains the kind on request,
 * and says in words when a document is missing or cannot be judged.
 *
 * Every assertion reads what a person reads — the chip's text, the
 * explanation's text, the sentence beside the bar. None reads `data-state`:
 * the bar copies that attribute from its input, so a test on it passes before
 * anything is built.
 */

/** A plan-bar position: everything before `at` done, `at` active, the rest pending. */
function position(
  at: PlanPosition,
  overrides: Record<string, string> = {},
): PlanPositionState {
  const index = PLAN_POSITIONS.indexOf(at);
  const segments: Record<string, string> = {};
  for (const [i, key] of PLAN_POSITIONS.entries()) {
    segments[key] = i < index ? "done" : i === index ? "active" : "pending";
  }
  // `missing` and `unknown` join the lifecycle's segment states in Build Phase 1.
  return {
    position: at,
    segments: { ...segments, ...overrides },
    awaiting: null,
  } as unknown as PlanPositionState;
}

/** The fields this plan adds to `Plan`, typed loosely until Build Phase 2. */
interface TypeFields {
  workflow?: string | null;
  workflowDeclared?: string | null;
}

function plan(type: TypeFields, at: PlanPositionState): Plan {
  return {
    name: "demo-plan",
    status: "in-progress",
    archived: false,
    brief: {
      frontmatter: { title: "Demo", status: "accepted" },
      content: "# Demo — Brief\n\n## Problem\n\nA problem.\n",
    },
    position: at,
    ...type,
  } as unknown as Plan;
}

const text = (el: Element | null) => el?.textContent ?? "";

describe("A1 — a declared type shows as a chip in the plan header", () => {
  it.each(["bugfix", "feature", "refactor", "spike"])(
    "%s",
    async (workflow) => {
      const { container } = await render(
        <PlanDetail plan={plan({ workflow }, position("executing"))} />,
      );
      const chip = container.querySelector(
        '[data-testid="plan-header"] [data-testid="plan-type-chip"]',
      );
      expect(chip, "no type chip in the plan header").not.toBeNull();
      expect(text(chip)).toContain(workflow);
    },
  );
});

describe("A2 — no declared type reads 'type not declared'", () => {
  it("says so in the header, and names no type", async () => {
    const { container } = await render(
      <PlanDetail plan={plan({}, position("executing"))} />,
    );
    const chip = container.querySelector('[data-testid="plan-type-chip"]');
    expect(chip, "no type chip in the plan header").not.toBeNull();
    expect(text(chip)).toContain("type not declared");
    for (const type of ["bugfix", "feature", "refactor", "spike"]) {
      expect(text(chip)).not.toContain(type);
    }
  });
});

describe("A3 — an unrecognised word is shown as written and called unrecognised", () => {
  it("is neither treated as a known type nor folded into 'not declared'", async () => {
    const { container } = await render(
      <PlanDetail
        plan={plan(
          { workflow: null, workflowDeclared: "hotfix" },
          position("executing"),
        )}
      />,
    );
    const chip = container.querySelector('[data-testid="plan-type-chip"]');
    expect(chip, "no type chip in the plan header").not.toBeNull();
    expect(text(chip)).toContain("hotfix");
    expect(text(chip)).toContain("not a recognised type");
    expect(text(chip)).not.toContain("type not declared");
  });
});

describe("A4 — the chip explains the type, and the explanation closes", () => {
  async function open(workflow: string) {
    const { container } = await render(
      <PlanDetail plan={plan({ workflow }, position("executing"))} />,
    );
    const chip = container.querySelector(
      '[data-testid="plan-type-chip"]',
    ) as HTMLButtonElement | null;
    expect(chip, "no type chip in the plan header").not.toBeNull();
    const dialog = () =>
      container.querySelector(
        '[data-testid="plan-type-dialog"]',
      ) as HTMLDialogElement | null;
    return { chip: chip as HTMLButtonElement, dialog };
  }

  it("is closed until the chip is clicked", async () => {
    const { dialog } = await open("bugfix");
    expect(dialog()?.open ?? false).toBe(false);
  });

  it("a bugfix: what it is for, that it requires a test plan, that it skips research and the ADR, and why", async () => {
    const { chip, dialog } = await open("bugfix");
    chip.click();
    await vi.waitFor(() => expect(dialog()?.open).toBe(true));
    const said = text(dialog()).toLowerCase();
    expect(said).toContain("bugfix");
    const requires = text(
      dialog()?.querySelector('[data-testid="plan-type-requires"]') ?? null,
    ).toLowerCase();
    const skips = text(
      dialog()?.querySelector('[data-testid="plan-type-skips"]') ?? null,
    ).toLowerCase();
    expect(requires).toContain("brief");
    expect(requires).toContain("test plan");
    expect(requires).not.toContain("research");
    expect(skips).toContain("research");
    expect(skips).toContain("adr");
    expect(
      text(dialog()?.querySelector('[data-testid="plan-type-why"]') ?? null)
        .length,
    ).toBeGreaterThan(20);
  });

  it("closes with its close button", async () => {
    const { chip, dialog } = await open("feature");
    chip.click();
    await vi.waitFor(() => expect(dialog()?.open).toBe(true));
    const close = dialog()?.querySelector<HTMLButtonElement>(
      '[data-testid="plan-type-dialog-close"]',
    );
    expect(close, "the explanation has no close button").toBeTruthy();
    close?.click();
    await vi.waitFor(() => expect(dialog()?.open).toBe(false));
  });

  it("closes with Escape", async () => {
    const { chip, dialog } = await open("feature");
    chip.click();
    await vi.waitFor(() => expect(dialog()?.open).toBe(true));
    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(dialog()?.open).toBe(false));
  });

  it("'type not declared' explains what declaring one would tell the page", async () => {
    const { container } = await render(
      <PlanDetail plan={plan({}, position("executing"))} />,
    );
    const chip = container.querySelector(
      '[data-testid="plan-type-chip"]',
    ) as HTMLButtonElement | null;
    expect(chip, "no type chip in the plan header").not.toBeNull();
    chip?.click();
    const dialog = () =>
      container.querySelector(
        '[data-testid="plan-type-dialog"]',
      ) as HTMLDialogElement | null;
    await vi.waitFor(() => expect(dialog()?.open).toBe(true));
    expect(text(dialog())).toContain("workflow:");
  });
});

describe("A10 — the page says in words what is missing or cannot be judged", () => {
  it("a missing document: which one, and that the type requires it", async () => {
    const { container } = await render(
      <PlanDetail
        plan={plan(
          { workflow: "bugfix" },
          position("executing", {
            research: "skipped",
            "test-plan": "missing",
            adr: "skipped",
          }),
        )}
      />,
    );
    const notes = text(
      container.querySelector('[data-testid="plan-bar-document-notes"]'),
    ).toLowerCase();
    expect(notes).toContain("test plan");
    expect(notes).toContain("missing");
    expect(notes).toContain("bugfix");
    expect(notes).toContain("requires");
    // Skipped is by design and stays quiet.
    expect(notes).not.toContain("research");
  });

  it("an unknown document: which one, and that no type is declared", async () => {
    const { container } = await render(
      <PlanDetail
        plan={plan(
          {},
          position("executing", { research: "unknown", adr: "unknown" }),
        )}
      />,
    );
    const notes = text(
      container.querySelector('[data-testid="plan-bar-document-notes"]'),
    ).toLowerCase();
    expect(notes).toContain("research");
    expect(notes).toContain("adr");
    expect(notes).toContain("no type");
  });

  it("nothing missing or unknown: no sentence at all", async () => {
    const { container } = await render(
      <PlanDetail
        plan={plan(
          { workflow: "bugfix" },
          position("executing", { research: "skipped", adr: "skipped" }),
        )}
      />,
    );
    expect(
      container.querySelector('[data-testid="plan-bar-document-notes"]'),
    ).toBeNull();
  });
});
