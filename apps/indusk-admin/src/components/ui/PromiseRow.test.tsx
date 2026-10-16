import "@/app/globals.css";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

// `next/link` pulls in Node-only globals the browser runtime lacks; a plain anchor does.
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

import { PromisesDashboard } from "@/components/Promises";
import { type DashboardRow, parseQuery } from "@/lib/promise-dashboard";
import { PromiseRow } from "./PromiseRow";

// promise: a-promise-is-upheld-or-broken

/**
 * A21 of one-promise-language: an enforced promise whose signal has never
 * reported is drawn with a grey dot and "no signal yet" in the promise list,
 * and turns green only once a signal reports it upheld. The approved look is
 * the mockup `promise-row.no-signal`.
 */
const row = (over: Partial<DashboardRow>): DashboardRow =>
  ({
    name: "a-message-sent-gets-a-reply",
    sentence: "A message sent in a project conversation is answered",
    plan: "new-project-flow",
    planTitle: "New project flow",
    path: null,
    pathTitle: null,
    standing: "enforced",
    tests: { passing: 2, total: 2 },
    held: null,
    broke: 0,
    lastActivity: null,
    lastBreak: null,
    ...over,
  }) as DashboardRow;

async function listOf(r: DashboardRow) {
  return render(
    <PromisesDashboard
      rows={[r]}
      query={parseQuery({})}
      pathOrder={[]}
      incidents={[]}
      promises={[]}
      path="/p/demo/promises"
      planHrefPrefix="/p/demo/plan/"
      promiseHrefPrefix="/p/demo/promises/"
    />,
  );
}

const dotOf = (el: Element) =>
  el.querySelector("[data-component='promise-row'] > span:first-child");

describe("A21 — no signal is grey, never green", () => {
  it("A21 a no-signal row's dot is the idle grey, not the ok green", async () => {
    const { container } = await render(
      <PromiseRow
        standing="no-signal"
        says="says"
        slug="slug"
        pips={[]}
        evals="tests pass"
        last="no signal yet"
      />,
    );
    const dot = dotOf(container);
    expect(dot?.className).toContain("bg-idle");
    expect(dot?.className).not.toContain("bg-ok");
    expect(container.textContent).toContain("no signal yet");
  });

  it("A21 an enforced promise nothing has reported is listed grey with no signal yet", async () => {
    const { container } = await listOf(row({ held: null }));
    const item = container.querySelector("[data-component='promise-row']");
    expect(item?.getAttribute("data-standing")).toBe("no-signal");
    expect(dotOf(container)?.className).toContain("bg-idle");
    expect(container.textContent).toContain("no signal yet");
  });

  it("A21 the same promise turns green once a signal has reported it", async () => {
    const { container } = await listOf(
      row({ held: 12, lastActivity: "2026-10-14T10:00:00Z" }),
    );
    const item = container.querySelector("[data-component='promise-row']");
    expect(item?.getAttribute("data-standing")).toBe("enforced");
    expect(dotOf(container)?.className).toContain("bg-ok");
  });
});
