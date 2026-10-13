import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { HistoryPanel } from "./HistoryPanel";

const entries = [
  {
    at: "2026-10-12T16:05:00Z",
    by: "Sandy",
    decision: "Brief accepted",
    answer: "Approve",
  },
  {
    at: "2026-10-13T09:41:00Z",
    by: "Sandy",
    decision: "Looks approved",
    answer: "Approve",
  },
];

/** The approved `history-panel` mockups: closed to one row, open to a newest-first list. */
describe("HistoryPanel", () => {
  it("is closed by default and says how many events it holds", async () => {
    const { container } = await render(<HistoryPanel entries={entries} />);
    const panel = container.querySelector("details") as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    expect(panel.querySelector("summary")?.textContent).toContain("History");
    expect(panel.querySelector("summary")?.textContent).toContain("2 events");
  });

  it("opened, lists the events newest first, each with what, who and when", async () => {
    const { container } = await render(<HistoryPanel entries={entries} />);
    const panel = container.querySelector("details") as HTMLDetailsElement;
    panel.querySelector("summary")?.click();
    expect(panel.open).toBe(true);
    const rows = [...panel.querySelectorAll('[data-testid="history-entry"]')];
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("Looks approved");
    expect(rows[0].textContent).toContain("2026-10-13 09:41");
    expect(rows[0].textContent).toContain("Sandy");
    expect(rows[1].textContent).toContain("Brief accepted");
  });

  it("offers no control to go back to an earlier point", async () => {
    const { container } = await render(<HistoryPanel entries={entries} open />);
    expect(container.querySelectorAll("button, a")).toHaveLength(0);
  });
});
