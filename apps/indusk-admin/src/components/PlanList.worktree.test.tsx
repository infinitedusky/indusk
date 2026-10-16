// promise: a-nav-row-keeps-its-parts-apart
// promise: every-plan-is-one-click-away
// promise: the-nav-fits-a-phone
import "@/app/globals.css";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import type { Plan } from "@/lib/planning-reader";

vi.mock("@infinitedusky/indusk-mcp/promises/display", () => ({
  __esModule: true,
  planTitle: (_title: unknown, handle: string) => handle,
}));
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: () => "/elsewhere",
}));

import { Nav } from "@/components/ui/Nav";
import { PlanList } from "./PlanList";

/**
 * nav-row-legible, Test Phase 1 (A1–A7): the real nav drawn with the real
 * stylesheet, a plan's row measured. A1–A5 are red until the worktree is a
 * mark of its own outside the plan's link; A6 and A7 pass today and guard the
 * collapsed nav and the worktree-less row.
 */

const WT = "nav-stage-matches-plan-page";
const LONG = "w".repeat(80);

function plan(name: string, worktreeName?: string): Plan {
  return {
    name,
    title: name,
    description: null,
    status: "in-progress",
    archived: false,
    ...(worktreeName
      ? {
          worktree: {
            name: worktreeName,
            path: `/wt/${worktreeName}`,
            branch: `plan/${worktreeName}`,
          },
        }
      : {}),
  } as Plan;
}

async function draw(opts: { worktree?: string; collapsed?: boolean } = {}) {
  const withWt = plan("with-wt", opts.worktree ?? WT);
  const without = plan("no-wt");
  const { container } = await render(
    <div style={{ width: opts.collapsed ? undefined : 280 }}>
      <Nav project="p" collapsed={opts.collapsed}>
        <PlanList
          active={[withWt, without]}
          archived={[]}
          masterOrder={["with-wt", "no-wt"]}
        />
      </Nav>
    </div>,
  );
  const rowOf = (name: string) =>
    container
      .querySelector(`[data-plan-name="${name}"]`)
      ?.closest('[data-component="plan-row"]') as HTMLElement;
  const row = rowOf("with-wt");
  const plainRow = rowOf("no-wt");
  const mark = row.querySelector(
    '[data-testid="plan-worktree"] button',
  ) as HTMLButtonElement | null;
  return { container, row, plainRow, mark };
}

const box = (el: Element) => el.getBoundingClientRect();
const centre = (el: Element) => {
  const b = box(el);
  return [b.left + b.width / 2, b.top + b.height / 2] as const;
};
const hit = (el: Element) => {
  const [x, y] = centre(el);
  return document.elementFromPoint(x, y);
};
const stageText = (row: HTMLElement) =>
  row.querySelectorAll("span.truncate")[1] as HTMLElement;
const titleText = (row: HTMLElement) =>
  row.querySelectorAll("span.truncate")[0] as HTMLElement;

beforeEach(async () => {
  await page.viewport(1280, 900);
});

describe("nav-row-legible — a plan's row keeps its parts apart", () => {
  it("A1 — title on line one, stage on line two, a textless mark 8 px after the stage; no taller", async () => {
    const { row, plainRow, mark } = await draw();
    expect(mark, "a worktree mark button").not.toBeNull();
    if (!mark) return;
    const title = box(titleText(row));
    const stage = box(stageText(row));
    expect(title.bottom).toBeLessThanOrEqual(stage.top + 0.5);
    const m = box(mark);
    expect(m.top + m.height / 2).toBeGreaterThanOrEqual(stage.top);
    expect(m.top + m.height / 2).toBeLessThanOrEqual(stage.bottom);
    const textRight = (() => {
      const r = document.createRange();
      r.selectNodeContents(stageText(row));
      return r.getBoundingClientRect().right;
    })();
    expect(Math.abs(m.left - textRight - 8)).toBeLessThanOrEqual(0.5);
    expect((mark.textContent ?? "").trim()).toBe("⎇");
    expect(box(row).height).toBeCloseTo(box(plainRow).height, 0);
  });

  it("A2 — clicking the mark does not open the plan; the rest of the row does", async () => {
    const { container, row, mark } = await draw();
    expect(mark, "a worktree mark button").not.toBeNull();
    if (!mark) return;
    expect(hit(mark)?.closest("a")).toBeNull();
    const link = container.querySelector(
      'a[data-plan-name="with-wt"]',
    ) as HTMLAnchorElement;
    let clicks = 0;
    link.addEventListener("click", (e) => {
      e.preventDefault();
      clicks += 1;
    });
    await userEvent.click(mark);
    expect(clicks).toBe(0);
    for (const part of [
      titleText(row),
      row.querySelector("[data-component='badge']") ?? row,
      stageText(row),
    ]) {
      expect(hit(part)?.closest('a[data-plan-name="with-wt"]')).toBe(link);
    }
  });

  it("A3 — hovering widens the mark in place to the name; leaving closes it", async () => {
    const { row, mark } = await draw();
    expect(mark, "a worktree mark button").not.toBeNull();
    if (!mark) return;
    const h = box(row).height;
    await userEvent.hover(mark);
    expect(mark.textContent).toContain(WT);
    const stage = box(stageText(row));
    const m = box(mark);
    expect(m.top + m.height / 2).toBeGreaterThanOrEqual(stage.top);
    expect(m.top + m.height / 2).toBeLessThanOrEqual(stage.bottom);
    expect(box(row).height).toBeCloseTo(h, 0);
    await userEvent.unhover(mark);
    expect(mark.textContent).not.toContain(WT);
  });

  it("A4 — click, Enter and Space toggle it, with aria-expanded", async () => {
    const { mark } = await draw();
    expect(mark, "a worktree mark button").not.toBeNull();
    if (!mark) return;
    await userEvent.click(mark);
    expect(mark.getAttribute("aria-expanded")).toBe("true");
    expect(mark.textContent).toContain(WT);
    await userEvent.click(mark);
    expect(mark.getAttribute("aria-expanded")).toBe("false");
    await userEvent.unhover(mark);
    expect(mark.textContent).not.toContain(WT);
    mark.focus();
    await userEvent.keyboard("{Enter}");
    expect(mark.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(mark.getAttribute("aria-expanded")).toBe("false");
    await userEvent.keyboard(" ");
    expect(mark.getAttribute("aria-expanded")).toBe("true");
  });

  it("A5 — a long name ends in an ellipsis inside the row; nothing scrolls sideways", async () => {
    const { row, mark } = await draw({ worktree: LONG });
    expect(mark, "a worktree mark button").not.toBeNull();
    if (!mark) return;
    const before = { w: box(row).width, h: box(row).height };
    await userEvent.click(mark);
    const name = [...mark.querySelectorAll("*")].find((e) =>
      e.textContent?.includes(LONG),
    ) as HTMLElement;
    expect(name, "the name element").toBeDefined();
    expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
    expect(getComputedStyle(name).textOverflow).toBe("ellipsis");
    expect(box(mark).right).toBeLessThanOrEqual(box(row).right + 0.5);
    expect(box(row).width).toBeCloseTo(before.w, 0);
    expect(box(row).height).toBeCloseTo(before.h, 0);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
  });
});

describe("nav-row-legible — what the stretched link takes from the row (A9–A10)", () => {
  it("A9 — hovering the title of a row with a worktree carries the full name as a tooltip", async () => {
    const { row } = await draw();
    const under = hit(titleText(row));
    expect(under?.closest("[title]")?.getAttribute("title")).toBe("with-wt");
  });

  it("A10 — keyboard focus on the plan's link marks the whole row, not only the title", async () => {
    const { container, row } = await draw();
    const link = container.querySelector(
      'a[data-plan-name="with-wt"]',
    ) as HTMLAnchorElement;
    for (let i = 0; i < 8 && document.activeElement !== link; i++) {
      await userEvent.tab();
    }
    expect(document.activeElement).toBe(link);
    const overlay = getComputedStyle(link, "::after");
    const ring =
      overlay.outlineStyle !== "none" && overlay.outlineWidth !== "0px";
    const around = ring ? box(row) : box(link);
    expect(around.height).toBeGreaterThanOrEqual(box(row).height - 0.5);
    expect(ring, "an outline on the overlay that spans the row").toBe(true);
  });
});

describe("nav-row-legible — guards that pass today", () => {
  it("A6 — collapsed: only the badge, no mark, as tall as any row, the badge opens the plan", async () => {
    const { container, row, plainRow, mark } = await draw({ collapsed: true });
    if (mark) expect(mark.checkVisibility()).toBe(false);
    const wt = row.querySelector('[data-testid="plan-worktree"]');
    if (wt) expect(wt.checkVisibility()).toBe(false);
    expect(box(row).height).toBeCloseTo(box(plainRow).height, 0);
    const badge = row.querySelector("[data-component='badge']") as HTMLElement;
    expect(hit(badge)?.closest("a[data-plan-name]")).toBe(
      container.querySelector('a[data-plan-name="with-wt"]'),
    );
  });

  it("A7 — a plan without a worktree is one link and holds no mark", async () => {
    const { plainRow } = await draw();
    expect(plainRow.matches("a[data-plan-name]")).toBe(true);
    expect(plainRow.getAttribute("href")).toBe("/plan/no-wt");
    expect(plainRow.querySelector('[data-testid="plan-worktree"]')).toBeNull();
  });
});
