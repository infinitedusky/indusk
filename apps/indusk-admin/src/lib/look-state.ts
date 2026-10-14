import { documentFinished } from "@infinitedusky/indusk-mcp/plans/steps";

/**
 * The state a plan's pages say they draw, for the look check
 * (`data-look-state`, ui-promises Build Phase 6): each is what the page really
 * is, read from the plan's own facts, never from a `?state=` a checker sends
 * (cockpit-redraw, per-state paths). The names are the mockups' —
 * `plan.<state>` and `brief.<state>` — and what a state means is the one rule
 * here, so the page and the check cannot disagree about it.
 */

export type PlanLookState =
  | "plan.released"
  | "plan.needs-you"
  | "plan.parts"
  | "plan.working";

export type BriefLookState = "brief.approved" | "brief.writing" | "brief.empty";

/**
 * The plan page's state: released once archived or in monitor; else
 * `needs-you` while it waits on a person; else `parts` while its brief is not
 * finished (the page opens on it as the current step); else being built.
 */
export function planLookState(input: {
  archived: boolean;
  position?: string;
  waiting: boolean;
  briefStatus: string | null;
}): PlanLookState {
  if (input.archived || input.position === "monitor") return "plan.released";
  if (input.waiting) return "plan.needs-you";
  if (!documentFinished("brief", input.briefStatus ?? undefined))
    return "plan.parts";
  return "plan.working";
}

/**
 * Whether the plan page is waiting on a person, for its look state: a session
 * question or a stopped build (`waiting`, from the package's `planWaiting`), or
 * an amendment the person has not re-approved — the page draws the amendment
 * card for it, and the approved `plan.needs-you` mockup is the one that does.
 */
export function planPageWaiting(
  waiting: unknown | undefined,
  amendments: readonly unknown[],
): boolean {
  return waiting !== undefined;
}

/**
 * The brief page's state: empty while the plan has no brief file; else
 * approved once the plan's impl carries the approval of its brief, writing
 * before.
 */
export function briefLookState(
  implFrontmatter: object | undefined,
  hasBriefFile: boolean,
): BriefLookState {
  if (!hasBriefFile) return "brief.empty";
  const approved = (implFrontmatter as Record<string, unknown> | undefined)
    ?.approved_brief;
  return approved ? "brief.approved" : "brief.writing";
}

export type NavLookState = "nav.collapsed" | "nav.wide" | "nav.expanded";

/**
 * The nav's state: folded to its strip, dragged (or asked) wider than the
 * foundation's width, or as it opens. `width` is null until the nav has been
 * measured, which is the opening width.
 */
export function navLookState(input: {
  folded: boolean;
  width: number | null;
  opening: number | null;
}): NavLookState {
  if (input.folded) return "nav.collapsed";
  if (
    input.width !== null &&
    input.opening !== null &&
    input.width > input.opening
  )
    return "nav.wide";
  return "nav.expanded";
}
