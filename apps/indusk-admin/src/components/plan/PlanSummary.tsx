/**
 * The top of a plan's page: what the plan is, in plain words, and its brief —
 * incomplete until accepted, and worked on only on the brief's own page.
 */
export function PlanSummary({
  description,
  briefStatus,
  briefHref,
}: {
  description: string | null;
  briefStatus: string | null;
  briefHref: string;
}) {
  const complete = briefStatus === "accepted";
  return (
    <div className="grid gap-2" data-testid="plan-summary">
      <p
        className={description ? "text-ink-soft" : "text-sm text-ink-faint"}
        data-testid="plan-description"
      >
        {description ?? "No description yet."}
      </p>
      <a className="text-sm text-ink-soft" href={briefHref}>
        {complete
          ? "Brief: accepted — open it"
          : "Brief: incomplete — work on it"}
      </a>
    </div>
  );
}
