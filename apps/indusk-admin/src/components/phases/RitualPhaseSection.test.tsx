import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { openSection } from "@/__tests__/helpers/sections";
import { extractPhases } from "@/lib/phases";
import { RitualPhaseSection } from "./RitualPhaseSection";

/**
 * admin-ui-phase-progress — A35 (cleanup).
 *
 * The Cleanup section was a near-byte copy of the Falsification phase section
 * with two headings changed. Both are now configurations of one component,
 * with the test ids and headings their existing tests read.
 */

function phaseFrom(markdown: string) {
  const [phase] = extractPhases(markdown, [
    {
      id: "A9",
      asserts: "a claim under test",
      writableAt: 3,
      passesAt: 3,
      writableAtKind: "build",
      passesAtKind: "build",
      state: "passing",
    },
  ]);
  return phase;
}

describe("A35 — one ritual section, two configurations", () => {
  it("falsification: the pre-existing ids and headings", async () => {
    const phase = phaseFrom(
      "### Phase 3: Falsification — the hunt\n- [x] fixed one\n- [ ] fix two\n\n#### Phase 3 Verification\n- [x] A9: holds\n",
    );
    const { container } = await render(
      <RitualPhaseSection
        ritual="falsification"
        planName="demo"
        phase={phase}
      />,
    );
    const section = container.querySelector(
      '[data-testid="falsification-section"]',
    );
    expect(section, "no falsification section").not.toBeNull();
    expect(section?.textContent).toContain("Falsification");
    expect(section?.textContent).toContain("Phase 3");
    expect(section?.textContent).toContain("in-progress");
    await openSection(container, "falsification-section");
    expect(
      container.querySelector('[data-testid="falsification-hypotheses"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="falsification-fix-items"]'),
    ).not.toBeNull();
    expect(section?.textContent).toContain("Hypotheses");
    expect(section?.textContent).toContain("Fix items");
    expect(section?.textContent).toContain("fix two");
  });

  it("cleanup: the pre-existing ids and headings, complete when everything is terminal", async () => {
    const phase = phaseFrom(
      "### Phase 3: Cleanup — the decomposition\n- [x] Extract the widget\n- [x] (reviewed x — left as-is)\n\n#### Phase 3 Verification\n- [x] A9: parity\n",
    );
    const { container } = await render(
      <RitualPhaseSection ritual="cleanup" planName="demo" phase={phase} />,
    );
    const section = container.querySelector('[data-testid="cleanup-section"]');
    expect(section, "no cleanup section").not.toBeNull();
    expect(section?.textContent).toContain("complete");
    await openSection(container, "cleanup-section");
    expect(
      container.querySelector('[data-testid="cleanup-rows"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="cleanup-items"]'),
    ).not.toBeNull();
    expect(section?.textContent).toContain("New units under test");
    expect(section?.textContent).toContain("Decomposition");
    expect(section?.textContent).toContain("Extract the widget");
  });
});
