import { documentFinished } from "@infinitedusky/indusk-mcp/plans/steps";
import { buttonClasses } from "@/components/ui/Button";

/**
 * The top of a plan's page: what the plan is, in one to three sentences, and
 * its brief. Until the brief is accepted, writing it is the plan's current
 * step, so it stands out as the one thing to do; after, it is a quiet link.
 * The brief is worked on only on its own page. Whether it is finished is the
 * package's rule (`documentFinished`), never a status compared here; a
 * superseded brief and an archived plan have no current step.
 */
export function PlanSummary({
  description,
  briefStatus,
  briefHref,
  archived = false,
}: {
  description: string | null;
  briefStatus: string | null;
  briefHref: string;
  archived?: boolean;
}) {
  const complete = documentFinished("brief", briefStatus ?? undefined);
  const noCurrentStep = archived || briefStatus === "superseded";
  return (
    <div className="grid gap-3" data-testid="plan-summary">
      <p
        className={description ? "text-ink-soft" : "text-sm text-ink-faint"}
        data-testid="plan-description"
      >
        {description ?? "No description yet."}
      </p>
      {complete || noCurrentStep ? (
        <a className="text-sm text-ink-soft" href={briefHref}>
          {complete ? "Brief: accepted — open it" : "Brief — open it"}
        </a>
      ) : (
        <div
          className="halo flex flex-wrap items-center gap-4 rounded-lg border border-dusk bg-surface px-5 py-snug"
          data-testid="brief-incomplete"
        >
          <div className="grid gap-1">
            <span className="font-mono text-2xs font-medium text-dusk">
              current step
            </span>
            <span className="text-md font-semibold">
              The brief is incomplete
            </span>
          </div>
          <a
            className={buttonClasses("primary", "md", "ml-auto")}
            href={briefHref}
          >
            Work on the brief
          </a>
        </div>
      )}
    </div>
  );
}
