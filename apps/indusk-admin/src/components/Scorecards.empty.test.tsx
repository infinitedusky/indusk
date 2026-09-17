import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// The scorecards page imports next/link transitively — stub as everywhere.
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

// The page's data layer hits node:fs; mock every export it imports, from the
// module it imports from (the known gotcha). `hasEvalDirectory` is the read
// Build Phase 6 adds — mocking it now is harmless and lets the page use it.
vi.mock("@/lib/planning-reader", () => ({
  __esModule: true,
  readEvalScorecards: async () => [],
}));

vi.mock("@/lib/project-reader", () => ({
  __esModule: true,
  hasEvalDirectory: () => false,
}));

vi.mock("@/lib/registry-client", () => ({
  __esModule: true,
  getProjectPath: (name: string) => (name === "fresh" ? "/mock/fresh" : null),
  projectPathExists: () => true,
}));

vi.mock("@/lib/vcs", () => ({
  __esModule: true,
  getCommitMessages: () => ({}),
}));

import PerProjectScorecardsPage from "@/app/p/[project]/scorecards/page";

/**
 * admin-ui-phase-progress — A24.
 *
 * `.indusk/eval/` is created by the evaluator's first append, so a project
 * shows no scorecards until its first evaluated commit — the "only loads
 * after a prompt" observation. That is the writer's behaviour, not the
 * admin's; the admin's honest change is to say so. Authored RED in Test
 * Phase 1 (today's text is "No eval scorecards recorded for this project
 * yet"); Build Phase 6.
 */

describe("A24 — a project with no eval directory says why it is empty", () => {
  it('renders "no evaluations recorded yet" and names the directory that appears on the first evaluated commit', async () => {
    const ui = await PerProjectScorecardsPage({
      params: Promise.resolve({ project: "fresh" }),
    });
    const { container } = await render(ui);
    expect(container.textContent).toContain("no evaluations recorded yet");
    expect(container.textContent).toContain(".indusk/eval/");
  });
});
