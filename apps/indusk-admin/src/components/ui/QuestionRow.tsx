import type { ReactNode } from "react";

export type QuestionCost = "cheap" | "moderate" | "expensive";

export interface QuestionRowOption {
  label: string;
  /** The option the agent recommends. */
  recommended?: boolean;
}

export interface QuestionRowProps {
  /** The cost as stored, never worked out here. */
  cost: QuestionCost;
  /** The question went ahead before anyone answered; `done` says what was done. */
  wentAhead?: boolean;
  /** Where it was asked, in words: the question's number and plan step. */
  where: string;
  /** The time left, or that the build is stopped, or when it went ahead. */
  when: string;
  text: string;
  /** The recommendation's reason, for a question still waiting. */
  reason?: string;
  options: QuestionRowOption[];
  /** What was done when it went ahead. */
  done?: string;
  /** The follow-on plan a late disagreeing answer opened. */
  followOn?: ReactNode;
  /** Answer with an option; when absent the options are only shown. */
  onChoose?: (label: string) => void;
  /** Keep what was done on a question that went ahead: answers with it, so no follow-on opens. */
  onKeep?: () => void;
  /** The "Reply in words" control. */
  onReply?: () => void;
  disabled?: boolean;
  /** The reply box, when the person is writing one. */
  children?: ReactNode;
}

const FRAME: Record<string, string> = {
  cheap: "border-line bg-surface",
  moderate: "border-line bg-surface",
  expensive: "border-bad bg-bad-wash",
  went: "border-line bg-ground",
};
const DOT: Record<string, string> = {
  cheap: "bg-dusk",
  moderate: "bg-warn",
  expensive: "bg-bad",
  went: "bg-idle",
};
const CHIP: Record<string, string> = {
  cheap: "bg-dusk-wash text-dusk",
  moderate: "bg-warn-wash text-ink",
  expensive: "bg-surface text-bad",
  went: "bg-idle-wash text-ink-faint",
};
const OPTION =
  "inline-flex items-center gap-2 rounded-lg border px-4 py-snug text-sm font-semibold leading-3 disabled:opacity-50";

/**
 * One question an unattended run asked, on the plan's page (decisions-as-questions):
 * its cost, where it was asked and how long it has, the question, the recommended
 * option and why, and a reply in words. An expensive question is drawn in red with
 * no timer: the build is stopped until the person answers. One that went ahead says
 * what was done, and offers a late answer. Presentational: the cost is the one the
 * package stored, and the answers go to the plan's question route from the page.
 */
export function QuestionRow({
  cost,
  wentAhead = false,
  where,
  when,
  text,
  reason,
  options,
  done,
  followOn,
  onChoose,
  onKeep,
  onReply,
  disabled = false,
  children,
}: QuestionRowProps) {
  const tone = wentAhead ? "went" : cost;
  const label = cost[0]?.toUpperCase() + cost.slice(1);
  return (
    <section
      data-component="question-row"
      data-cost={cost}
      {...(wentAhead ? { "data-went-ahead": "true" } : {})}
      className={`grid gap-3 rounded-xl border px-5 py-4 ${FRAME[tone]}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-3 text-ink-soft">
        <span className={`size-dot rounded-pill ${DOT[tone]}`} />
        <span
          className={`rounded-pill px-tight py-1 font-mono text-2xs font-semibold uppercase leading-1 tracking-caps ${CHIP[tone]}`}
        >
          {wentAhead ? `${label} · went ahead` : label}
        </span>
        {where}
        <span
          className={`ml-auto font-mono text-xs leading-2 ${cost === "expensive" && !wentAhead ? "font-semibold text-bad" : "text-ink-faint"}`}
        >
          {when}
        </span>
      </div>
      <h3 className="text-md font-semibold leading-4">{text}</h3>
      {wentAhead ? (
        <p className="text-sm leading-3 text-ink-soft">
          Nobody answered in time, so it went ahead with{" "}
          <b className="font-semibold text-ink">{done}</b>, as recommended.
        </p>
      ) : reason ? (
        <p className="max-w-content text-sm leading-3 text-ink-soft">
          Recommended: {options.find((o) => o.recommended)?.label}. {reason}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-snug">
        {wentAhead && onKeep ? (
          <button
            type="button"
            data-testid="question-keep"
            disabled={disabled}
            onClick={onKeep}
            className={`${OPTION} border-ink bg-ink text-surface`}
          >
            Keep {done}
          </button>
        ) : null}
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            disabled={disabled || !onChoose}
            onClick={() => onChoose?.(o.label)}
            className={`${OPTION} ${
              o.recommended && !wentAhead
                ? "border-ink bg-ink text-surface"
                : "border-line bg-surface text-ink"
            }`}
          >
            {wentAhead ? `Choose ${o.label} instead` : o.label}
            {o.recommended && !wentAhead ? (
              <span className="text-2xs font-medium leading-1 text-surface">
                recommended
              </span>
            ) : null}
          </button>
        ))}
        {!wentAhead && onReply ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onReply}
            className="text-sm font-medium leading-3 text-dusk"
          >
            Reply in words
          </button>
        ) : null}
      </div>
      {children}
      {wentAhead ? (
        <p className="text-xs leading-2 text-ink-faint">
          {followOn ?? (
            <>
              Choosing differently now opens a follow-on plan to change it, and
              the release waits until that plan is closed.
            </>
          )}
        </p>
      ) : null}
    </section>
  );
}
