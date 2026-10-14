"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Nav } from "@/components/ui/Nav";
import { NavHandle } from "@/components/ui/NavHandle";
import { Shell } from "@/components/ui/Shell";
import { navLookState } from "@/lib/look-state";

export interface CockpitFrameProps {
  project: string;
  /** Under the project's name in the nav: "9 plans". */
  summary: string;
  /** What the nav holds: plan groups, plan rows and view links. */
  nav: ReactNode;
  /** The page. */
  children: ReactNode;
}

/** Where a desktop reader's collapse choice is kept, per browser. */
const COLLAPSED_KEY = "indusk-admin.nav.collapsed";

/** Where a desktop reader's dragged nav width is kept, per browser. */
const WIDTH_KEY = "indusk-admin.nav.width";

/** The width from which the nav is a rail beside the page rather than a drawer. */
const RAIL_QUERY = "(min-width: 760px)";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // storage blocked: the rail still folds for this page
  }
}

function readWidth(): number | null {
  try {
    const n = Number.parseFloat(localStorage.getItem(WIDTH_KEY) ?? "");
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // storage blocked: the nav keeps the width for this page
  }
}

/** The query parameter that sets the nav's width for one page, in pixels. */
const WIDTH_PARAM = "nav";

/** The width a link or a check asks for with `?nav=<px>`; null when it asks for none. */
function readAskedWidth(): number | null {
  const n = Number.parseFloat(
    new URLSearchParams(window.location.search).get(WIDTH_PARAM) ?? "",
  );
  return Number.isFinite(n) ? n : null;
}

/** The narrowest and widest the nav drags to, read from the foundation's `--size-nav` and `--size-nav-max`. */
function readBounds(): { min: number; max: number } {
  const style = getComputedStyle(document.documentElement);
  const size = (name: string) =>
    Number.parseFloat(style.getPropertyValue(name));
  return { min: size("--size-nav"), max: size("--size-nav-max") };
}

/**
 * The frame every project page sits in: the `Shell` with the `Nav` in its
 * first column and the page beside it. Below 760 px the nav is a drawer —
 * closed, opened by a menu button, taking no room from the page. From 760 px
 * up it is a rail with a collapse button that folds it to its marks; the
 * choice is kept in `localStorage` and read after mount, so the server and the
 * first client render agree and a blocked store still renders the open rail.
 * A drawer is never folded: the choice is a desktop one. The rail's edge
 * drags (`NavHandle`) between `--size-nav` and `--size-nav-max`; the width is
 * kept the same way, survives a collapse, and a drawer has no edge.
 *
 * promise: the-nav-fits-a-phone
 * promise: the-nav-widens-by-dragging
 */
export function CockpitFrame({
  project,
  summary,
  nav,
  children,
}: CockpitFrameProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [wide, setWide] = useState(true);
  const [bounds, setBounds] = useState<{ min: number; max: number } | null>(
    null,
  );
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    setCollapsed(readCollapsed());
    const read = readBounds();
    setBounds(read);
    // A width asked for in the address is the person's own setting for this
    // page: it wins over the kept one and is not kept (so a check that opens a
    // fresh browser can draw the nav wide, as `nav.wide` is).
    const asked = readAskedWidth() ?? readWidth();
    if (asked !== null) setWidth(Math.min(read.max, Math.max(read.min, asked)));
  }, []);

  useEffect(() => {
    const query = window.matchMedia(RAIL_QUERY);
    setWide(query.matches);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // A drawer that stayed open over the page it just navigated to would hide it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is the trigger, not an input
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  };
  const folded = collapsed && wide;
  const dragged = wide && !folded && bounds !== null && width !== null;
  // What the nav really draws, for the look check (`data-look-state`).
  const lookState = navLookState({
    folded,
    width: dragged ? width : null,
    opening: bounds?.min ?? null,
  });

  return (
    <>
      <button
        type="button"
        data-testid="nav-menu-button"
        aria-expanded={open}
        aria-controls="cockpit-nav"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((v) => !v)}
        className="fixed left-2 top-2 z-50 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink-soft elevated min-[760px]:hidden"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 min-[760px]:hidden"
        />
      )}
      <Shell
        collapsed={folded}
        style={
          dragged
            ? { gridTemplateColumns: `${width}px minmax(0, 1fr)` }
            : undefined
        }
      >
        <aside
          id="cockpit-nav"
          data-testid="cockpit-nav"
          data-open={open ? "true" : "false"}
          data-collapsed={collapsed ? "true" : "false"}
          data-look-state={lookState}
          className={`fixed inset-y-0 left-0 z-40 min-h-0 w-nav nav-drawer ${
            open ? "translate-x-0" : "-translate-x-full"
          } min-[760px]:relative min-[760px]:w-auto min-[760px]:max-w-none min-[760px]:translate-x-0`}
        >
          <Nav
            project={project}
            summary={summary}
            collapsed={folded}
            className="h-full overflow-y-auto overflow-x-hidden"
            toggleProps={{
              "data-testid": "nav-collapse-button",
              "aria-expanded": !collapsed,
              "aria-controls": "cockpit-nav",
              onClick: toggleCollapsed,
              className: "max-[759px]:hidden",
            }}
          >
            {nav}
          </Nav>
          {wide && !folded && bounds && (
            <NavHandle
              value={width ?? bounds.min}
              min={bounds.min}
              max={bounds.max}
              onResize={setWidth}
              onResizeEnd={writeWidth}
            />
          )}
        </aside>
        <main className="min-h-0 min-w-0 overflow-y-auto p-6 max-[759px]:pt-16">
          {children}
        </main>
      </Shell>
    </>
  );
}
