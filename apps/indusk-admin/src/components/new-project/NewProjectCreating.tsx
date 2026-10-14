export interface CreatingStep {
  label: string;
  state: "done" | "working" | "waiting" | "failed";
}

/** Stub: Build Phase 3 draws the creation here. */
export function NewProjectCreating(_props: {
  steps: readonly CreatingStep[];
  name?: string;
  location?: string;
  href?: string;
  problem?: string | null;
}) {
  return null;
}
