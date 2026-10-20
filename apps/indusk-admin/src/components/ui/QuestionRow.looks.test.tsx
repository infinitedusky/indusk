// look: question-row.cheap
// look: question-row.expensive
// look: question-row.went-ahead
import "@/app/globals.css";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { QuestionRow } from "./QuestionRow";

/**
 * decisions-as-questions T41: the question rows drawn in Chromium with the real stylesheet.
 * An expensive row is in the foundation's bad colour with no timer, a cheap row shows its
 * time left, a went-ahead row shows what was done. A row drawn otherwise fails here, which
 * the earlier file checks (approvals, stories, lint) cannot see.
 */
const options = [{ label: "sqlite", recommended: true }, { label: "files" }];

/** The colour a foundation token resolves to, as the browser computes it. */
function token(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

const settle = () => new Promise((r) => setTimeout(r, 50));

describe("T41 — the question rows draw as their looks say", () => {
  it("an expensive row is in the foundation's bad colour and shows no time", async () => {
    const { container } = await render(
      <QuestionRow
        cost="expensive"
        where="q-2 · Build"
        when="the build is stopped until you answer"
        text="Drop the promise?"
        reason="it is unreachable"
        options={options}
      />,
    );
    await settle();
    const row = container.querySelector(
      '[data-component="question-row"]',
    ) as HTMLElement;
    expect(getComputedStyle(row).borderTopColor).toBe(token("--color-bad"));
    expect(row.textContent).not.toMatch(/goes ahead in/);
    expect(row.textContent).toContain("the build is stopped until you answer");
  });

  it("a cheap row is not in the bad colour and shows its time left", async () => {
    const { container } = await render(
      <QuestionRow
        cost="cheap"
        where="q-1 · Build"
        when="goes ahead in 4 min"
        text="Which store?"
        reason="simplest"
        options={options}
      />,
    );
    await settle();
    const row = container.querySelector(
      '[data-component="question-row"]',
    ) as HTMLElement;
    expect(getComputedStyle(row).borderTopColor).not.toBe(token("--color-bad"));
    expect(row.textContent).toContain("goes ahead in 4 min");
  });

  it("a went-ahead row shows what was done", async () => {
    const { container } = await render(
      <QuestionRow
        cost="cheap"
        wentAhead
        where="q-1 · Build"
        when="12 min ago"
        text="Which store?"
        done="sqlite"
        options={[{ label: "files" }]}
      />,
    );
    await settle();
    const row = container.querySelector(
      '[data-component="question-row"]',
    ) as HTMLElement;
    expect(row.textContent).toContain("went ahead with sqlite");
    expect(row.textContent).toContain("12 min ago");
    expect(getComputedStyle(row).borderTopColor).not.toBe(token("--color-bad"));
  });
});
