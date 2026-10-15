import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ButtonOrLink } from "./ButtonOrLink";

export type PromiseStanding = "declared" | "proving" | "enforced" | "broken";
export type PipState = "planned" | "written" | "passing";

export interface PromiseRowProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  standing: PromiseStanding;
  /** The promise in a sentence. */
  says: string;
  /** Its name. */
  slug: ReactNode;
  /** One pip per test, in the state it is in. */
  pips: readonly PipState[];
  evals: ReactNode;
  last: ReactNode;
  /** Where the promise's page is. A link when given, a button when not. */
  href?: string;
  /** With no promises to list: the words that say so, in place of a row. */
  empty?: string;
}

const DOT: Record<PromiseStanding, string> = {
  declared: "bg-idle",
  proving: "bg-warn",
  enforced: "bg-ok",
  broken: "bg-bad",
};

const PIP: Record<PipState, string> = {
  planned: "border-line bg-idle-wash",
  written: "border-warn bg-warn-wash",
  passing: "border-ok bg-ok",
};

/**
 * A promise in the list: its standing as a dot, what it says and what it is
 * called, a pip for each test, how its evals held and when it was last heard
 * from. Given `empty` it is the list's empty state instead.
 */
export function PromiseRow({
  standing,
  says,
  slug,
  pips,
  evals,
  last,
  empty,
  href,
  className = "",
  ...rest
}: PromiseRowProps) {
  if (empty !== undefined) {
    return (
      <div
        data-component="promise-row"
        className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}
      >
        <div className="p-5 text-md leading-4 text-ink-faint">{empty}</div>
      </div>
    );
  }
  return (
    <ButtonOrLink
      href={href}
      data-component="promise-row"
      data-standing={standing}
      className={`cols-promise-row grid w-full items-center gap-4 border-t border-line px-4 py-3 text-left first:border-t-0 ${className}`}
      {...rest}
    >
      <span className={`size-dot-lg rounded-pill ${DOT[standing]}`} />
      <span>
        <span className="block font-medium leading-4">{says}</span>
        <span className="mt-hair block font-mono text-xs leading-2 text-ink-faint wrap-anywhere">
          {slug}
        </span>
      </span>
      <span className="flex gap-1 max-[759px]:hidden">
        {pips.map((pip, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: pips are positional
            key={i}
            className={`h-pip-h w-pip rounded-xs border ${PIP[pip]}`}
          />
        ))}
      </span>
      <span className="text-sm leading-3 text-ink-soft max-[759px]:hidden">
        {evals}
      </span>
      <span className="text-right text-sm leading-3 text-ink-faint">
        {last}
      </span>
    </ButtonOrLink>
  );
}
