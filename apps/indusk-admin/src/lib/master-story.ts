import { initialsOf } from "@/lib/initials";
import type { PathEntry, PlanGroup } from "@/lib/plan-groups";
import { planStage } from "@/lib/plan-stage";

/** One plan in its master's story, in declared order. */
export interface StoryRow {
  number: number;
  /** The folder name: links and addresses, never shown. */
  handle: string;
  title: string;
  initials: string;
  description: string;
  state: "released" | "draft" | "queued";
  stage: string;
  /** Absent for a plan with no folder: nothing to open. */
  href?: string;
}

/** The counts the page's line reads: the Path group's, so the nav's `released/total` agrees. */
export interface StoryCounts {
  released: number;
  drafts: number;
  queued: number;
  total: number;
}

export interface MasterStory {
  rows: StoryRow[];
  counts: StoryCounts;
}

const queuedIn = (group: PlanGroup): number =>
  group.entries.reduce(
    (n, e) =>
      n +
      (e.kind === "placeholder"
        ? 1
        : e.kind === "path"
          ? queuedIn(e.group)
          : 0),
    0,
  );

/**
 * A master's story from the Path group `buildGroups` made for it: a row per
 * declared entry and the three counts. A plan is released when a release
 * shipped it (`isReleased`, the Path count's rule), queued when it has no
 * folder, else a draft saying its stage as the nav row says it (what it waits
 * on, else its status). A Path declared inside reads as one row linking to its
 * own page. The counts are the group's own `released` and `total`, so the page
 * and the nav cannot disagree.
 */
export function masterStory(
  group: PlanGroup,
  isReleased: (plan: string) => boolean,
  options: { prefix: string; waiting?: Record<string, string> },
): MasterStory {
  const rowOf = (entry: PathEntry): StoryRow => {
    if (entry.kind === "placeholder") {
      const { title } = entry;
      return {
        number: entry.number,
        handle: entry.name,
        title,
        initials: initialsOf(title),
        description: entry.description,
        state: "queued",
        stage: "Queued",
      };
    }
    if (entry.kind === "path") {
      const { parent, released, total } = entry.group;
      return {
        number: entry.number,
        handle: parent.name,
        title: parent.title,
        initials: initialsOf(parent.title),
        description: parent.description ?? "",
        state: released === total ? "released" : "draft",
        stage: `${released} of ${total} released`,
        href: `${options.prefix}${parent.name}`,
      };
    }
    const { plan } = entry;
    const released = isReleased(plan.name);
    return {
      number: entry.number,
      handle: plan.name,
      title: plan.title,
      initials: initialsOf(plan.title),
      description: plan.description ?? "",
      state: released ? "released" : "draft",
      stage: planStage(plan, released, options.waiting),
      href: `${options.prefix}${plan.name}`,
    };
  };
  const queued = queuedIn(group);
  return {
    rows: group.entries.map(rowOf),
    counts: {
      released: group.released,
      drafts: group.total - group.released - queued,
      queued,
      total: group.total,
    },
  };
}
