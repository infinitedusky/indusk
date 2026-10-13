import { Tag } from "@/components/ui/Tag";
import type { Plan } from "@/lib/planning-reader";

/**
 * Which copy of a plan the page is showing (admin-plan-worktrees).
 *
 * A plan worked in its worktree is read from there; the chip names that
 * worktree so it is always clear the live copy is on screen. The notice says
 * why the trunk copy stands in when the assignment is broken, and that no
 * copy is shown when the assignment record cannot be read. None of these is
 * guessed: each renders only what the resolver reported.
 *
 * The project layout's two pieces live here too: the worktrees nobody
 * assigned, and the record's error when it cannot be read.
 *
 * Its own file, with no client boundary, like `HoldingBadge`: the sidebar
 * rows, the plan header and the layout are server components.
 */

export function WorktreeChip({ plan }: { plan: Plan }) {
  if (!plan.worktree) return null;
  const { name, path, branch } = plan.worktree;
  return (
    <Tag
      data-testid="plan-worktree"
      title={`Read from the worktree at ${path} (${branch})`}
    >
      <span aria-hidden="true">⎇</span> {name}
    </Tag>
  );
}

export function PlanCopyNotice({ plan }: { plan: Plan }) {
  if (plan.copyError) {
    return (
      <div
        role="alert"
        data-testid="plan-copy-error"
        className="rounded-md border border-bad bg-bad-wash px-3 py-2 text-sm text-bad"
      >
        The plan-worktree assignment record {plan.copyError.file} cannot be read
        ({plan.copyError.problem}), so which copy of this plan is live is
        unknown and none is shown. Fix or remove the file.
      </div>
    );
  }
  if (plan.worktree && plan.archivedInWorktree) {
    return (
      <output
        data-testid="plan-copy-archived"
        className="block rounded-md border border-line bg-ground px-3 py-2 text-sm text-ink-soft"
      >
        This plan is archived in its worktree {plan.worktree.name}, awaiting
        landing: the retrospective moved it on{" "}
        <code>{plan.worktree.branch}</code>, and it reads from the trunk once
        the branch merges and the assignment is released.
      </output>
    );
  }
  if (plan.copyProblem) {
    return (
      <output
        data-testid="plan-copy-problem"
        className="block rounded-md border border-warn bg-warn-wash px-3 py-2 text-sm text-warn"
      >
        {plan.copyProblem.kind === "gone"
          ? `The ${plan.copyProblem.detail} — showing the trunk copy. Release it with indusk worktree release ${plan.name}, or assign the plan again.`
          : plan.copyProblem.kind === "missing"
            ? `The ${plan.copyProblem.detail} — showing the trunk copy.`
            : `${plan.copyProblem.detail} — showing the trunk copy until one is released.`}
      </output>
    );
  }
  return null;
}

/** Worktrees of the project that hold no plan assignment, so none goes unseen. */
export function UnassignedWorktrees({
  worktrees,
}: {
  worktrees: { name: string; path: string; branch: string | null }[];
}) {
  if (worktrees.length === 0) return null;
  return (
    <nav
      className="flex flex-col gap-1 pt-3 border-t border-line mt-3"
      data-testid="unassigned-worktrees"
    >
      <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-caps text-ink-faint">
        Unassigned worktrees
      </h3>
      {worktrees.map((w) => (
        <span
          key={w.path}
          className="truncate px-2 py-1 text-sm text-ink-soft"
          title={`${w.path} — assign it with indusk worktree assign <plan> ${w.path}`}
        >
          {w.name}
          {w.branch ? (
            <span className="ml-1 text-xs text-ink-faint">{w.branch}</span>
          ) : null}
        </span>
      ))}
    </nav>
  );
}

/** The assignment record cannot be read: say so above the plan list, naming the file. */
export function WorktreeRecordError({
  file,
  problem,
}: {
  file: string;
  problem: string;
}) {
  return (
    <div
      role="alert"
      data-testid="worktree-record-error"
      className="mb-3 rounded-md border border-bad bg-bad-wash px-2 py-tight text-xs text-bad"
    >
      The plan-worktree assignment record {file} cannot be read ({problem}).
      Plans are listed by name only until it is fixed or removed.
    </div>
  );
}
