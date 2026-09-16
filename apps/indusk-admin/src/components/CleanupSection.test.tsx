import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

// PlanDetail imports next/link — stub it like every other browser test.
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
 * admin-ui-phase-progress — A27 (added at the U1 review, Sandy 2026-09-16:
 * "we also need a cleanup section").
 *
 * The cleanup ritual's phase is one of the two close-out rituals and gets a
 * section of its own beside Falsification — its items are the decomposition,
 * its rows the new units' tests — instead of being listed as a follow-up
 * phase. Like every section it is closed by default.
 */

const IMPL = `## Checklist

### Phase 1: Build

- [x] build it

#### Phase 1 Verification
- [x] T1 passes

### Phase 2: Falsification — hunt

- [x] fix the thing

#### Phase 2 Verification
- [x] T2 passes

### Phase 3: Cleanup — decompose

- [x] Extract the widget into widget.ts
- [ ] (reviewed page.tsx — left as-is: cohesive)

#### Phase 3 Verification
- [ ] T3 passes
`;

function plan(): Plan {
  return {
    name: "ritual-plan",
    status: "in-progress",
    archived: false,
    impl: {
      frontmatter: { title: "Ritual plan", status: "in-progress" },
      content: IMPL,
    },
  };
}

async function open(container: Element, testId: string) {
  const button = container.querySelector(
    `[data-testid="${testId}"] [aria-expanded="false"]`,
  ) as HTMLElement | null;
  button?.click();
  await new Promise((r) => setTimeout(r, 50));
}

describe("A27 — the cleanup phase renders as its own section", () => {
  it("a Cleanup section exists, closed by default, with the phase's items once opened; it is not a follow-up phase", async () => {
    const { container } = await render(<PlanDetail plan={plan()} />);
    const cleanup = container.querySelector('[data-testid="cleanup-section"]');
    expect(cleanup, "no cleanup section rendered").not.toBeNull();
    expect(
      cleanup?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded"),
    ).toBe("false");
    expect(cleanup?.textContent).toContain("Phase 3");
    expect(cleanup?.textContent).toContain("in-progress");
    await open(container, "cleanup-section");
    expect(cleanup?.textContent).toContain("Extract the widget into widget.ts");
    expect(cleanup?.textContent).toContain("left as-is");
    expect(
      container.querySelector('[data-testid="followup-phases-section"]'),
      "the cleanup phase must not also render as a follow-up phase",
    ).toBeNull();
  });
});
