"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";

export interface CollapsibleSectionProps {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  /** Optional right-aligned content in the header (e.g. status badge, count). */
  headerRight?: ReactNode;
  className?: string;
  /**
   * When set, persists the open/closed state to `localStorage[persistKey]`
   * (`"1"` = open, `"0"` = closed). Initial state is read from storage;
   * toggling writes back. Falls back to `defaultOpen` when no stored value
   * exists or when localStorage is unavailable (SSR, privacy mode).
   *
   * Conventional key shape: `"plan:{planName}:section:{slug}"` so the
   * mapping is stable across renders and unique per (plan, section).
   */
  persistKey?: string;
  /**
   * When set, renders a copy-to-clipboard icon button in the header that
   * copies this markdown string (heading included) verbatim. Omit to hide
   * the button — most non-plan uses of this component don't need it.
   */
  copyMarkdown?: string;
}

function readPersisted(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === "1") return true;
    if (stored === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function writePersisted(key: string | undefined, open: boolean): void {
  if (!key) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, open ? "1" : "0");
  } catch {
    // swallow — privacy mode / quota; best-effort persistence
  }
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  headerRight,
  className = "",
  persistKey,
  copyMarkdown,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(() =>
    readPersisted(persistKey, defaultOpen),
  );
  const Chevron = open ? ChevronDown : ChevronRight;

  const toggle = (): void => {
    setOpen((o) => {
      const next = !o;
      writePersisted(persistKey, next);
      return next;
    });
  };

  return (
    <div className={`rounded-md border border-gray-200 ${className}`}>
      <div className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-gray-900">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 rounded text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
        >
          <Chevron className="h-4 w-4 text-gray-500" aria-hidden />
          <span>{title}</span>
        </button>
        {(headerRight || copyMarkdown) && (
          <span className="ml-auto flex items-center gap-2">
            {headerRight}
            {copyMarkdown ? (
              <CopyButton
                text={copyMarkdown}
                label="Copy section as markdown"
              />
            ) : null}
          </span>
        )}
      </div>
      {open ? (
        <div className="border-t border-gray-200 p-3">{children}</div>
      ) : null}
    </div>
  );
}
