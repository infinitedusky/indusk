/**
 * Which control on a plan's page shows the running session
 * (admin-plan-authoring): planning sessions belong to the planning controls,
 * build sessions to the build controls. Both asked "is a session running for
 * this plan?" and so both showed a build's session — two panels, two message
 * boxes (Sandy, 2026-10-06). One rule, read by both, so they cannot overlap.
 */
export interface RunningSession {
  id: string;
  project: string;
  plan: string;
  kind: string;
}

export function ownsSession(
  session: RunningSession | null | undefined,
  project: string,
  plan: string,
  kind: "planning" | "build",
): session is RunningSession {
  return (
    !!session &&
    session.project === project &&
    session.plan === plan &&
    session.kind === kind
  );
}
