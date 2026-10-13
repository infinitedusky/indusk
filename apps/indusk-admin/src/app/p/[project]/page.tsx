import { readDraftRows } from "@infinitedusky/indusk-mcp/drafts";
import { DraftList } from "@/components/drafts/DraftList";
import { NewPlanForm } from "@/components/session/NewPlanForm";
import { TrustNotice } from "@/components/session/TrustNotice";
import { getProjectPath } from "@/lib/registry-client";
import { projectTrusted } from "@/lib/trust-reader";

interface PerProjectPageProps {
  params: Promise<{ project: string }>;
}

/**
 * Per-project landing page. The layout (`app/p/[project]/layout.tsx`) owns
 * the sidebar + PlanList AND the stale-project failure branch (T11) — when
 * the registry lookup fails or the path is deleted, the layout replaces
 * its own output entirely with `<StaleProjectFailurePage>` and this page's
 * rendered element is never placed in the DOM.
 *
 * So the page is an unconditional empty-state — no notFound() call, no
 * re-check of the project path. Trust the layout.
 */
export default async function PerProjectPage({ params }: PerProjectPageProps) {
  // New plan (brief-as-the-contract) needs only the project's name; the
  // conversations not yet kept are listed beneath it.
  const { project } = await params;
  const root = getProjectPath(project);
  const drafts = root ? readDraftRows(root) : [];
  const trusted = root ? projectTrusted(root) : true;

  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-ink-faint">
      <h1 className="text-lg font-semibold text-ink-soft">Select a plan</h1>
      <p className="mt-2 max-w-sm text-sm">
        Pick a plan from the sidebar to see its phases, trajectory rows, and
        falsification log.
      </p>
      <div className="mt-6 w-full max-w-sm">
        <TrustNotice project={project} trusted={trusted} />
        <NewPlanForm project={project} />
      </div>
      <div className="mt-6 w-full max-w-content">
        <DraftList project={project} drafts={drafts} />
      </div>
    </div>
  );
}
