// promise: the-nav-widens-by-dragging

import "@/app/globals.css";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

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
  usePathname: () => "/p/seats/plan/mid-build",
}));

import { CockpitFrame } from "./CockpitFrame";

/**
 * cockpit-redraw A1–A4 — the nav's edge drags, and the width is the person's.
 *
 * `CockpitFrame` is rendered with the app's real stylesheet in Chromium at a
 * set viewport. The DOM these rows read is the contract Build Phase 2 builds
 * to:
 *   - the edge:  `role="separator"` (vertical), inside the nav's column; a
 *                pointer pressed on it and moved anywhere moves the width by
 *                the pointer's `clientX` travel
 *   - the nav:   `[data-testid="cockpit-nav"]`, its width the column's
 *   - the page:  `main`, whatever the nav leaves
 *   - collapse:  `[data-testid="nav-collapse-button"]`
 * The widest and narrowest allowed widths are the foundation's
 * (`--size-nav-max`, `--size-nav`); the rows find them by dragging past them,
 * never by repeating the numbers.
 */

const KEY = "indusk-admin.nav.width";

const navEl = () =>
  document.querySelector<HTMLElement>('[data-testid="cockpit-nav"]');
const navWidth = () => navEl()?.getBoundingClientRect().width ?? 0;
const mainWidth = () =>
  document.querySelector("main")?.getBoundingClientRect().width ?? 0;
const edge = () => document.querySelector<HTMLElement>('[role="separator"]');

async function frame() {
  return render(
    <CockpitFrame project="seats" summary="3 plans" nav={<span>plans</span>}>
      <p>the page</p>
    </CockpitFrame>,
  );
}

/** Press the edge, move the pointer `dx` pixels, release. */
function drag(dx: number) {
  const el = edge();
  expect(el, "the nav has no drag edge").not.toBeNull();
  const box = (el as HTMLElement).getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const init = { bubbles: true, pointerId: 1, isPrimary: true, clientY: y };
  (el as HTMLElement).dispatchEvent(
    new PointerEvent("pointerdown", { ...init, clientX: x, buttons: 1 }),
  );
  (el as HTMLElement).dispatchEvent(
    new PointerEvent("pointermove", { ...init, clientX: x + dx, buttons: 1 }),
  );
  (el as HTMLElement).dispatchEvent(
    new PointerEvent("pointerup", { ...init, clientX: x + dx }),
  );
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // storage blocked: the frame must still render
  }
});

describe("A1 — dragging the nav's edge widens or narrows it, within limits", () => {
  it("A1 dragging right widens the nav and narrows the page; past the ends it stops", async () => {
    await page.viewport(1280, 900);
    await frame();
    const start = navWidth();
    const pageStart = mainWidth();

    drag(60);
    await vi.waitFor(() => expect(navWidth()).toBeGreaterThan(start));
    expect(mainWidth()).toBeLessThan(pageStart);

    drag(5000);
    await vi.waitFor(() => expect(navWidth()).toBeGreaterThan(start + 60));
    const widest = navWidth();
    expect(widest, "the nav ate the window").toBeLessThan(1280);
    drag(500);
    expect(navWidth(), "dragging past the widest moved it").toBe(widest);

    drag(-5000);
    await vi.waitFor(() => expect(navWidth()).toBeLessThan(widest));
    const narrowest = navWidth();
    drag(-500);
    expect(navWidth(), "dragging past the narrowest moved it").toBe(narrowest);
    expect(narrowest).toBeLessThanOrEqual(start);
  });
});

describe("A2 — after a reload the nav opens at the width it was left at", () => {
  it("A2 keeps the dragged width across a fresh render", async () => {
    await page.viewport(1280, 900);
    const first = await frame();
    drag(80);
    await vi.waitFor(() => expect(localStorage.getItem(KEY)).not.toBeNull());
    const left = navWidth();

    // A reload: built again from nothing, the browser's storage kept.
    await first.unmount();
    await frame();
    await vi.waitFor(() => expect(navWidth()).toBe(left));
  });
});

describe("A3 — below 760 px there is no drag edge", () => {
  it("A3 has an edge on a desktop and none at 400 px, where the nav is a drawer", async () => {
    await page.viewport(1280, 900);
    await frame();
    expect(
      edge(),
      "no drag edge at 1280 px, so its absence proves nothing",
    ).not.toBeNull();

    await page.viewport(400, 800);
    await vi.waitFor(() => expect(edge()).toBeNull());
    expect(navEl()?.getAttribute("data-open")).toBe("false");
  });
});

describe("A4 — collapsing and expanding returns the nav to its dragged width", () => {
  it("A4 drag, collapse to the strip, expand: the same width", async () => {
    await page.viewport(1280, 900);
    await frame();
    drag(90);
    await vi.waitFor(() => expect(navWidth()).toBeGreaterThan(0));
    const dragged = navWidth();

    const collapse = document.querySelector<HTMLElement>(
      '[data-testid="nav-collapse-button"]',
    );
    await userEvent.click(collapse as HTMLElement);
    await vi.waitFor(() =>
      expect(navEl()?.getAttribute("data-collapsed")).toBe("true"),
    );
    expect(navWidth()).toBeLessThan(dragged);

    await userEvent.click(collapse as HTMLElement);
    await vi.waitFor(() =>
      expect(navEl()?.getAttribute("data-collapsed")).toBe("false"),
    );
    await vi.waitFor(() => expect(navWidth()).toBe(dragged));
  });
});

describe("the nav says which look it draws, and a width asked for in the address is drawn", () => {
  const lookState = () =>
    navEl()?.getAttribute("data-look-state") ?? "(no state)";

  it("reports nav.expanded as it opens and nav.collapsed once folded", async () => {
    await page.viewport(1280, 900);
    await frame();
    expect(lookState()).toBe("nav.expanded");
    (
      document.querySelector(
        '[data-testid="nav-collapse-button"]',
      ) as HTMLElement
    ).click();
    await vi.waitFor(() => expect(lookState()).toBe("nav.collapsed"));
  });

  it("?nav=<px> draws the nav wider as nav.wide, clamped, and keeps nothing", async () => {
    await page.viewport(1280, 900);
    const first = await frame();
    const opened = navWidth();
    first.unmount();
    window.history.replaceState(null, "", "?nav=5000");
    try {
      await frame();
      await vi.waitFor(() => expect(lookState()).toBe("nav.wide"));
      expect(navWidth()).toBeGreaterThan(opened);
      expect(navWidth(), "the nav ate the window").toBeLessThan(1280);
      expect(localStorage.getItem(KEY), "the asked width was kept").toBeNull();
    } finally {
      window.history.replaceState(null, "", window.location.pathname);
    }
  });
});
