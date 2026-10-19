import type { Plan } from "@/lib/planning-reader";

/**
 * The plan's situation in words and what happens next and who takes it
 * (a-run-can-be-trusted: `says-what-is-true`, `always-a-next-step`). The sentence and the
 * next step come from the package's one reader through `plan.situation`; this lays them
 * out and composes nothing, so the page and the nav row cannot disagree.
 */

const WHO = {
  system: "the system",
  person: "you",
  event: "an event",
} as const;

export function PlanSituationLine({
  situation,
}: {
  situation: NonNullable<Plan["situation"]>;
}) {
  const { situation: said, next } = situation;
  return (
    <div
      className="grid gap-hair text-sm text-ink-soft"
      data-testid="plan-situation-line"
      data-situation={said.kind}
    >
      <p data-testid="plan-situation-text">{said.text}</p>
      {next ? (
        <p className="text-ink-faint" data-testid="plan-next-step">
          Next, {WHO[next.by]}: {next.text}
        </p>
      ) : null}
    </div>
  );
}
