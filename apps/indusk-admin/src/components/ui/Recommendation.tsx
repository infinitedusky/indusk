import type { HTMLAttributes, ReactNode } from "react";

export type RecommendationState = "kept" | "declined";

export interface RecommendationProps
  extends Omit<HTMLAttributes<HTMLLIElement>, "title"> {
  state: RecommendationState;
  /** The practice, in a few words. */
  title: string;
  /** One line on why it is recommended. */
  why?: string;
  /** The person's reason, in their words; shown once it is declined. */
  reason?: string;
  /** Decline, or Keep it after all: the button the page gives it. */
  action?: ReactNode;
  /** Anything under the reason: the field a decline asks for. */
  children?: ReactNode;
}

const SHAPE: Record<RecommendationState, string> = {
  kept: "border-line bg-surface",
  declined: "border-dashed border-line bg-ground",
};

/**
 * A practice the agent recommends: a dot that says kept or declined, what it
 * is, one line on why, and the button that changes its mind. Declined, it is
 * dashed on the ground and carries the person's reason.
 */
export function Recommendation({
  state,
  title,
  why,
  reason,
  action,
  children,
  className = "",
  ...rest
}: RecommendationProps) {
  const declined = state === "declined";
  return (
    <li
      data-component="recommendation"
      data-state={state}
      className={`grid cols-recommendation items-start gap-3 rounded-lg border px-4 py-3 ${SHAPE[state]} ${className}`}
      {...rest}
    >
      <span
        className={`mt-2 size-dot flex-none rounded-pill ${declined ? "bg-idle" : "bg-ok"}`}
      />
      <div>
        <h3
          className={`text-base leading-5 font-semibold ${declined ? "text-ink-soft" : ""}`}
        >
          {declined ? `${title} — declined` : title}
        </h3>
        {why ? <p className="text-sm leading-3 text-ink-faint">{why}</p> : null}
        {declined && reason ? (
          <p className="text-sm leading-3 text-warn">Your reason: {reason}</p>
        ) : null}
        {children}
      </div>
      {action}
    </li>
  );
}
