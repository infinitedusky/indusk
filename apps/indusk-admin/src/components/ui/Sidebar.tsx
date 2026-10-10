"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

export interface SidebarProps {
  /** Optional header content (project name, version, controls). */
  header?: ReactNode;
  /** Main content of the sidebar — typically the plan list. */
  children: ReactNode;
  className?: string;
}

/** Where a desktop reader's collapse choice is kept, per browser. */
const COLLAPSED_KEY = "indusk-admin.nav.collapsed";

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
    // storage blocked: the strip still collapses for this page
  }
}

/**
 * The nav's frame. Below 760 px it is a drawer: closed, opened by a menu
 * button, and it takes no room from the page. From 760 px up it is a rail with
 * a collapse button that folds it to a strip; the choice is kept in
 * `localStorage` and read after mount, so the server and the first client
 * render agree and a blocked store still renders the open rail.
 */
export function Sidebar({ header, children, className = "" }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
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

  return (
    <>
      <button
        type="button"
        data-testid="nav-menu-button"
        aria-expanded={open}
        aria-controls="cockpit-nav"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((v) => !v)}
        className="fixed left-2 top-2 z-50 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 shadow-sm min-[760px]:hidden"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 min-[760px]:hidden"
        />
      )}
      <aside
        id="cockpit-nav"
        data-testid="cockpit-nav"
        data-open={open ? "true" : "false"}
        data-collapsed={collapsed ? "true" : "false"}
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 max-w-[85vw] flex-shrink-0 flex-col border-r border-gray-200 bg-white ${
          open ? "translate-x-0" : "-translate-x-full"
        } min-[760px]:static min-[760px]:max-w-none min-[760px]:translate-x-0 ${
          collapsed ? "min-[760px]:w-12" : ""
        } ${className}`}
      >
        <div className="hidden flex-shrink-0 justify-end border-b border-gray-200 px-2 py-1 min-[760px]:flex">
          <button
            type="button"
            data-testid="nav-collapse-button"
            aria-expanded={!collapsed}
            aria-controls="cockpit-nav-body"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={toggleCollapsed}
            className="rounded px-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <div
          id="cockpit-nav-body"
          className={`flex min-h-0 flex-1 flex-col ${
            collapsed ? "min-[760px]:hidden" : ""
          }`}
        >
          {header ? (
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 max-[759px]:pt-12">
              {header}
            </div>
          ) : null}
          <div className="flex-1 overflow-y-auto px-2 py-3">{children}</div>
        </div>
      </aside>
    </>
  );
}
