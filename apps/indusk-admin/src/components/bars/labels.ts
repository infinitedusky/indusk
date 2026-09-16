import type {
  PhaseActivity,
  PlanPosition,
  SegmentState,
  StageKind,
} from "@infinitedusky/indusk-mcp/lifecycle";

/**
 * Every label the bars render, typed against the lifecycle's own unions.
 *
 * `satisfies Record<…>` is the convention's teeth (admin-ui-phase-progress,
 * ADR D9): a plan that adds a position, an activity or a gate kind to
 * `lib/lifecycle.ts` fails the admin's type-check here until it also adds the
 * label — and `lifecycle-render-parity.test.ts` names the missing member.
 * The UI cannot drift behind the system the way its phase parser once did.
 */

export const POSITION_LABELS = {
  research: "research",
  brief: "brief",
  "test-plan": "test plan",
  adr: "ADR",
  "impl-approved": "impl approved",
  executing: "executing",
  falsify: "falsify",
  cleanup: "cleanup",
  retrospective: "retrospective",
  archived: "archived",
  monitor: "monitor",
} satisfies Record<PlanPosition, string>;

export const ACTIVITY_LABELS = {
  authoring: "authoring",
  implementing: "implementing",
  instrumenting: "instrumenting",
  verifying: "verifying",
  "capturing-context": "capturing context",
  documenting: "documenting",
  closed: "closed",
  falsifying: "falsifying",
  "cleaning-up": "cleaning up",
} satisfies Record<PhaseActivity, string>;

export const STAGE_LABELS = {
  implementation: "implementation",
  Verification: "Verification",
  OTel: "OTel",
  Context: "Context",
  Document: "Document",
} satisfies Record<StageKind, string>;

/** A bar segment's state — the lifecycle's four, plus a gate's opt-out. */
export type BarState = SegmentState | "opted-out";

export const SEGMENT_CLASS = {
  done: "bg-green-500",
  active: "bg-blue-500",
  pending: "bg-gray-200",
  skipped: "bg-gray-100",
  "opted-out": "bg-amber-400",
} satisfies Record<BarState, string>;

export const CHIP_CLASS = {
  done: "border-green-200 bg-green-50 text-green-800",
  active: "border-blue-200 bg-blue-50 text-blue-800",
  pending: "border-gray-200 bg-white text-gray-500",
  skipped: "border-gray-200 bg-gray-50 text-gray-400 line-through",
  "opted-out": "border-amber-200 bg-amber-50 text-amber-800",
} satisfies Record<BarState, string>;
