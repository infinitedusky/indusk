import type { HTMLAttributes } from "react";

export interface DraftRowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** What the conversation is about, in a line. */
  title: string;
  /** How long it has been since anyone talked in it, as the page words it. */
  age: string;
  /** Untouched for days: the age is drawn warm, so the person sees it will go. */
  aged?: boolean;
  onReopen?: () => void;
  onDiscard?: () => void;
}

const BUTTON =
  "rounded-lg border px-3 py-snug text-sm leading-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50";

/**
 * One conversation that has not become a plan: what it is about, how long since
 * it was talked in, and Reopen and Discard. It lives outside the repository
 * until a name is accepted for it.
 */
export function DraftRow({
  title,
  age,
  aged = false,
  onReopen,
  onDiscard,
  className = "",
  ...rest
}: DraftRowProps) {
  return (
    <div
      data-component="draft-row"
      className={`cols-draft-row grid items-center gap-4 border-t border-line px-4 py-3 first:border-t-0 ${className}`}
      {...rest}
    >
      <span className="grid min-w-0 gap-hair">
        <b className="font-medium wrap-anywhere">{title}</b>
        <span
          className={`font-mono text-xs leading-2 ${aged ? "font-semibold text-warn" : "text-ink-faint"}`}
        >
          {age}
        </span>
      </span>
      <span className="flex gap-snug">
        <button
          type="button"
          className={`${BUTTON} border-ink bg-ink text-surface`}
          onClick={onReopen}
        >
          Reopen
        </button>
        <button
          type="button"
          className={`${BUTTON} border-line bg-surface`}
          onClick={onDiscard}
        >
          Discard
        </button>
      </span>
    </div>
  );
}
