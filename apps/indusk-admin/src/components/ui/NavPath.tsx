"use client";

import Link from "next/link";
import { type HTMLAttributes, type ReactNode, useState } from "react";

export interface NavPathProps extends HTMLAttributes<HTMLDivElement> {
  /** The Path's name. */
  name: string;
  /** Its place inside the Path above it, 1-up; omitted at the top. */
  number?: ReactNode;
  /** How many of its plans a release shipped, "5/8"; or how many an Archived folds. */
  count?: ReactNode;
  /** A mark between the name and the count: the dusk dot of a plan inside that needs you. */
  mark?: ReactNode;
  /** Where the name goes (the Path's own plan page). Omitted: the whole row folds and opens. */
  href?: string;
  /** What a reader who does not see the count hears the row called: "Archived (92)". */
  label?: string;
  /** Attributes on the name's link. */
  linkProps?: Record<string, unknown>;
  /** The Path drawn open. */
  defaultOpen?: boolean;
  /** Set apart below the plans: the Archived fold. */
  apart?: boolean;
  /** The plans and Paths inside. */
  children?: ReactNode;
}

const ROW =
  "cols-nav-path grid w-full items-center gap-2 rounded-lg border border-transparent py-tight px-tight text-left text-ink";

/**
 * A Path in the nav: a row that folds the plans declared under it, with the
 * count a release has shipped. Its children sit in a column indented under it.
 * Not a component a mockup names — it carries no marker; the nav's story draws
 * it as the approved nav does.
 */
export function NavPath({
  name,
  number,
  count,
  mark,
  href,
  linkProps,
  label,
  defaultOpen = true,
  apart = false,
  children,
  className = "",
  ...rest
}: NavPathProps) {
  const [open, setOpen] = useState(defaultOpen);
  const chevron = (
    <span aria-hidden="true" className="text-sm leading-3 text-ink-faint">
      {open ? "▾" : "▸"}
    </span>
  );
  const nameClass = "truncate text-md font-semibold leading-4";
  const tail = (
    <>
      <span>{mark}</span>
      <span className="font-mono text-2xs font-medium leading-1 tabular-nums text-ink-faint">
        {count}
      </span>
    </>
  );
  const numberCell = (
    <span className="text-right font-mono text-2xs font-medium leading-1 tabular-nums text-ink-faint">
      {number}
    </span>
  );
  return (
    <div
      className={`nav-hide grid gap-hair ${apart ? "mt-3" : ""} ${className}`}
      {...rest}
    >
      {href === undefined ? (
        <button
          type="button"
          aria-expanded={open}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className={ROW}
        >
          {numberCell}
          {chevron}
          <span className={nameClass}>{name}</span>
          {tail}
        </button>
      ) : (
        <div className={ROW}>
          {numberCell}
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Fold" : "Open"} ${name}`}
            onClick={() => setOpen((v) => !v)}
          >
            {chevron}
          </button>
          <Link href={href} title={name} className={nameClass} {...linkProps}>
            {name}
          </Link>
          {tail}
        </div>
      )}
      {open && children ? (
        <div className="ml-6 grid gap-hair border-l border-line pl-tight">
          {children}
        </div>
      ) : null}
    </div>
  );
}
