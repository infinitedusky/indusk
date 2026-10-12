import {
  looksCheckouts,
  readLooks,
  resolveLooksCheckout,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { LooksBody, type OpenMockup } from "@/components/looks/Looks";
import type { OpenStory } from "@/components/looks/Stories";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface LooksRouteProps {
  params: Promise<{ project: string }>;
  /**
   * `?app=<app>&mockup=<name>&device=<device>` — the mockup open in its frame,
   * or `?app=<app>&story=<name>&device=<device>` — the story;
   * `checkout=<plan>` — the plan worktree read, the project's own when absent.
   */
  searchParams?: Promise<{
    app?: string;
    mockup?: string;
    story?: string;
    device?: string;
    view?: string;
    checkout?: string;
  }>;
}

/**
 * Per-project Looks page — `/p/{project}/looks` (ui-promises ADR decisions
 * 2, 3, 5): each app's mockups, proposed or approved, at the app's reference
 * devices; Approve on a proposed one; what no approved mockup covers. Read
 * through the package's `looks/overview` on every request — the admin
 * computes no look's state (`cockpit-single-definition.test.ts`). A look is
 * read, and approved, in the checkout its plan is worked in.
 *
 * promise: mockups-render-in-the-cockpit
 */
export default async function PerProjectLooksPage({
  params,
  searchParams,
}: LooksRouteProps) {
  const { project } = await params;
  const projectPath = getProjectPath(project);
  if (!projectPath || !projectPathExists(projectPath)) {
    return (
      <StaleProjectFailurePage
        projectName={project}
        projectPath={projectPath ?? undefined}
      />
    );
  }
  const query = (await searchParams) ?? {};
  const open: OpenMockup | null =
    query.app && query.mockup && query.device
      ? { app: query.app, mockup: query.mockup, device: query.device }
      : null;
  const openStory: OpenStory | null =
    query.app && query.story
      ? {
          app: query.app,
          story: query.story,
          device: query.device ?? null,
        }
      : null;
  const checkout = await resolveLooksCheckout(projectPath, query.checkout);
  if ("problem" in checkout) {
    return (
      <p role="alert" data-testid="looks-problem" className="text-sm text-bad">
        {checkout.problem}
      </p>
    );
  }
  return (
    <LooksBody
      project={project}
      apps={await readLooks(checkout.root)}
      path={`/p/${project}/looks`}
      open={open}
      openStory={openStory}
      view={query.view === "cascade" ? "cascade" : "list"}
      checkout={checkout.plan}
      checkouts={await looksCheckouts(projectPath)}
    />
  );
}
