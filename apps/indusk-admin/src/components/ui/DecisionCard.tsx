import type { ReactNode } from "react";

export type DecisionTone = "ask" | "info" | "alert";
export type DecisionWho = "ok" | "ask" | "busy";

export interface DecisionCardProps {
  /** `ask` waits on a person; `info` reports; `alert` is a broken promise's fix. */
  tone?: DecisionTone;
  /** Who is acting and how: a dot (done, waiting, working) and the words beside it. */
  who?: { label: string; state: DecisionWho };
  title?: string;
  /** The words, the answers, the reply, the progress. */
  children?: ReactNode;
  className?: string;
}

const TONE: Record<DecisionTone, string> = {
  ask: "elevated gap-4 rounded-xl border border-dusk bg-surface p-6",
  info: "elevated gap-4 rounded-xl border border-line bg-surface p-6",
  alert: "gap-snug rounded-xl border border-bad bg-bad-wash px-5 py-3",
};

const DOT: Record<DecisionWho, string> = {
  ok: "bg-ok",
  ask: "bg-dusk",
  busy: "pulse bg-dusk",
};

/**
 * What a plan or a promise has to say to a person: the one decision waiting on
 * them, the work Claude is doing, a release, or a broken promise with its fix.
 * Presentational — the cockpit's decision route and its answers live in the
 * page that holds it.
 */
export function DecisionCard({
  tone = "info",
  who,
  title,
  children,
  className = "",
}: DecisionCardProps) {
  return (
    <section
      data-component="decision-card"
      data-tone={tone}
      className={`grid ${TONE[tone]} ${className}`}
    >
      {who ? (
        <div className="flex items-center gap-2 text-sm leading-3 text-ink-faint">
          <span className={`size-dot-lg rounded-pill ${DOT[who.state]}`} />
          {who.label}
        </div>
      ) : null}
      {title ? (
        <h2 className="font-display text-2xl font-bold leading-6">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}
