import { readLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import { LooksBody, type OpenMockup } from "@/components/looks/Looks";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface LooksRouteProps {
  params: Promise<{ project: string }>;
  /** `?app=<app>&mockup=<name>&device=<device>` — the mockup open in its frame. */
  searchParams?: Promise<{ app?: string; mockup?: string; device?: string }>;
}

/**
 * Per-project Looks page — `/p/{project}/looks` (ui-promises ADR decisions
 * 2, 3, 5): each app's mockups, proposed or approved, at the app's reference
 * devices; Approve on a proposed one; what no approved mockup covers. Read
 * through the package's `looks/overview` on every request — the admin
 * computes no look's state (`cockpit-single-definition.test.ts`).
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
  return (
    <LooksBody
      project={project}
      apps={await readLooks(projectPath)}
      path={`/p/${project}/looks`}
      open={open}
    />
  );
}
