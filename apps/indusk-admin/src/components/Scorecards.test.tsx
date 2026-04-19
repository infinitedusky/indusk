import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { ScorecardsList } from "./Scorecards";

describe("ScorecardsList — global scorecards view (T11)", () => {
  it("renders a header showing the count and source", async () => {
    const cards = [
      {
        timestamp: "2026-04-19T11:00:00Z",
        changeId: "abcdef1234567890",
        mode: "feature",
        summary: "First commit",
      },
    ];
    const { container } = await render(<ScorecardsList scorecards={cards} />);
    const list = container.querySelector('[data-testid="scorecards-list"]');
    expect(list).not.toBeNull();
    expect(list?.textContent).toContain("Eval Scorecards");
    expect(list?.textContent).toContain("1 entries");
  });

  it("renders one collapsible card per scorecard with truncated changeId + summary visible in the header", async () => {
    const cards = [
      {
        timestamp: "2026-04-19T11:00:00Z",
        changeId: "abcdef1234567890",
        mode: "feature",
        summary: "Newest commit",
      },
      {
        timestamp: "2026-04-19T10:00:00Z",
        changeId: "fedcba0987654321",
        mode: "bugfix",
        summary: "Earlier commit",
        error: true,
        message: "claude exited with code 1",
      },
    ];
    const { container } = await render(<ScorecardsList scorecards={cards} />);
    const list = container.querySelector('[data-testid="scorecards-list"]');

    expect(list?.textContent).toContain("abcdef12");
    expect(list?.textContent).toContain("Newest commit");
    expect(list?.textContent).toContain("fedcba09");
    expect(list?.textContent).toContain("Earlier commit");

    // Status badges
    expect(list?.textContent).toContain("✓ ok");
    expect(list?.textContent).toContain("✗ error");
  });

  it("empty-state copy when no scorecards exist", async () => {
    const { container } = await render(<ScorecardsList scorecards={[]} />);
    const empty = container.querySelector('[data-testid="scorecards-empty"]');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain("No scorecards yet");
  });

  it("expanding a card shows the question/answer/finding details", async () => {
    const cards = [
      {
        timestamp: "2026-04-19T11:00:00Z",
        changeId: "abcdef1234567890",
        summary: "Test",
        questions: [
          {
            id: "conventions",
            question: "Did the agent follow conventions?",
            answer: "yes",
            severity: "info",
            finding: "Followed existing LogWriter pattern",
            evidence: "src/lib/...",
          },
        ],
      },
    ];
    const { container } = await render(<ScorecardsList scorecards={cards} />);
    const header = container.querySelector("[aria-expanded]") as HTMLElement;
    expect(header).not.toBeNull();
    header.click();
    await new Promise((r) => setTimeout(r, 50));

    const text = container.textContent ?? "";
    expect(text).toContain("conventions");
    expect(text).toContain("Did the agent follow conventions?");
    expect(text).toContain("Followed existing LogWriter pattern");
    expect(text).toContain("src/lib/...");
  });

  it("error-shape scorecard surfaces the error message in a red pre-block", async () => {
    const cards = [
      {
        timestamp: "2026-04-19T11:00:00Z",
        changeId: "abcdef1234567890",
        error: true,
        message: "claude exited with code 1: spawn error",
      },
    ];
    const { container } = await render(<ScorecardsList scorecards={cards} />);
    const header = container.querySelector("[aria-expanded]") as HTMLElement;
    header?.click();
    await new Promise((r) => setTimeout(r, 50));

    expect(container.textContent).toContain("claude exited with code 1: spawn error");
  });
});
