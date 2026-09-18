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
    <span
      data-testid="plan-worktree"
      title={`Read from the worktree at ${path} (${branch})`}
      className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs text-blue-800"
    >
      <span aria-hidden="true">⎇</span>
      {name}
    </span>
  );
}

export function PlanCopyNotice({ plan }: { plan: Plan }) {
  if (plan.copyError) {
    return (
      <div
        role="alert"
        data-testid="plan-copy-error"
        className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
      >
        The plan-worktree assignment record {plan.copyError.file} cannot be read
        ({plan.copyError.problem}), so which copy of this plan is live is
        unknown and none is shown. Fix or remove the file.
      </div>
    );
  }
  if (plan.copyProblem) {
    return (
      <output
        data-testid="plan-copy-problem"
        className="block rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
      >
        {plan.copyProblem.kind === "gone"
          ? `The ${plan.copyProblem.detail} — showing the trunk copy. Release it with indusk worktree release ${plan.name}, or assign the plan again.`
          : `${plan.copyProblem.detail} — showing the trunk copy until one is released.`}
      </output>
    );
  }
  if (plan.worktree) {
    return (
      <p data-testid="plan-copy-source" className="text-xs text-gray-500">
        Read from the worktree {plan.worktree.name} on{" "}
        <code>{plan.worktree.branch}</code>, where this plan is being worked.
      </p>
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
      className="flex flex-col gap-1 pt-3 border-t border-gray-200 mt-3"
      data-testid="unassigned-worktrees"
    >
      <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Unassigned worktrees
      </h3>
      {worktrees.map((w) => (
        <span
          key={w.path}
          className="truncate px-2 py-1 text-sm text-gray-700"
          title={`${w.path} — assign it with indusk worktree assign <plan> ${w.path}`}
        >
          {w.name}
          {w.branch ? (
            <span className="ml-1 text-xs text-gray-500">{w.branch}</span>
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
      className="mb-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800"
    >
      The plan-worktree assignment record {file} cannot be read ({problem}).
      Plans are listed by name only until it is fixed or removed.
    </div>
  );
}
