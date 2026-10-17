import type { PhaseKind } from "@infinitedusky/indusk-mcp/impl-headings";
import type {
  PhaseActivity,
  PlanPosition,
  RitualWord,
  SegmentState,
  StageKind,
} from "@infinitedusky/indusk-mcp/lifecycle";
import type { PromiseHealth } from "@infinitedusky/indusk-mcp/promises/health";
import type {
  PromiseKind,
  PromiseState,
} from "@infinitedusky/indusk-mcp/promises/registry";
import type {
  LookStanding,
  Standing,
} from "@infinitedusky/indusk-mcp/promises/standing";

/**
 * A promise's chip: its declared state, and nothing else (day-promises, ADR
 * D8). There is no health axis in this step — not a hidden one, none — so an
 * `enforced` promise is drawn HOLLOW (border, white fill) and says so in its
 * accessible name: declared, not yet observed. Green must mean "seen holding",
 * and nothing here has seen anything. `satisfies Record<PromiseState, …>` and
 * `lifecycle-render-parity.test.ts` name a state added without a chip.
 */
export const PROMISE_STATE_CHIP = {
  declared: {
    label: "declared",
    aria: "declared — stated in planning, not yet established",
    className: "border border-dashed border-ink-faint bg-surface text-ink-soft",
  },
  enforced: {
    label: "enforced",
    aria: "declared, not yet observed",
    className: "border border-ok bg-surface text-ok",
  },
  "known-broken": {
    label: "known broken",
    aria: "known broken — an incident says why",
    className: "border border-warn bg-warn-wash text-warn",
  },
  retired: {
    label: "retired",
    aria: "retired — kept for history",
    className: "border border-line bg-ground text-ink-faint",
  },
} satisfies Record<
  PromiseState,
  { label: string; aria: string; className: string }
>;

/**
 * A promise's observed health (day-monitor, ADR D9) — the second axis,
 * beside the declared-state chip. Green only ever means seen holding; no signal,
 * and Jaeger unreachable, are hollow "no signal". Under the same
 * `satisfies Record` pin as every other chip map.
 */
export const PROMISE_HEALTH_CHIP = {
  red: {
    label: "broken",
    aria: "broken in the window",
    className: "border border-bad bg-bad text-surface",
    dot: "bg-bad",
  },
  fixed: {
    label: "broke — fixed",
    aria: "broke in the window, every incident fixed",
    className: "border border-ink-soft bg-ink-soft text-surface",
    dot: "bg-ink-soft",
  },
  green: {
    label: "holding",
    aria: "seen holding in the window",
    className: "border border-ok bg-ok text-surface",
    dot: "bg-ok",
  },
  unverified: {
    label: "no signal",
    aria: "no signal in the window",
    className: "border border-ink-faint bg-surface text-ink-soft",
    dot: "bg-idle",
  },
  amber: {
    label: "known broken",
    aria: "declared known broken",
    className: "border border-warn bg-warn-wash text-warn",
    dot: "bg-warn",
  },
  grey: {
    label: "retired",
    aria: "retired — not watched",
    className: "border border-line bg-idle-wash text-ink-faint",
    dot: "bg-idle",
  },
} satisfies Record<
  PromiseHealth,
  { label: string; aria: string; className: string; dot: string }
>;

export const PROMISE_KIND_LABELS = {
  behaviour: "behaviour",
  state: "state",
  structure: "structure",
} satisfies Record<PromiseKind, string>;

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
  audit: "audit",
  review: "review",
  accepted: "accepted",
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

/** A bar segment's state — the lifecycle's, plus a gate's opt-out. */
export type BarState = SegmentState | "opted-out";

/**
 * The fill of a segment. `skipped`, `missing` and `unknown` are all empty —
 * they are told apart by the segment's frame (`SEGMENT_FRAME_CLASS`), because
 * each says something different about an absent document (admin-plan-type):
 * by design, a gap, and cannot be judged.
 */
export const SEGMENT_CLASS = {
  done: "bg-ok",
  active: "bg-dusk",
  pending: "bg-idle-wash",
  skipped: "bg-idle-wash",
  missing: "bg-bad-wash",
  unknown: "bg-surface",
  "opted-out": "bg-warn",
} satisfies Record<BarState, string>;

/** The segment's own box: what makes an empty segment read as one state and not another. */
export const SEGMENT_FRAME_CLASS = {
  done: "bg-idle-wash",
  active: "bg-idle-wash",
  pending: "bg-idle-wash",
  skipped: "border border-dashed border-line bg-surface",
  missing: "border border-bad bg-bad-wash",
  unknown: "border border-dotted border-ink-faint bg-surface",
  "opted-out": "bg-idle-wash",
} satisfies Record<BarState, string>;

/** The word under a segment, styled by state, when a bar shows its labels. */
export const SEGMENT_LABEL_CLASS = {
  done: "text-ink-soft",
  active: "font-semibold text-dusk",
  pending: "text-ink-faint",
  skipped: "text-ink-faint line-through",
  missing: "font-semibold text-bad",
  unknown: "italic text-ink-faint",
  "opted-out": "text-ink-soft",
} satisfies Record<BarState, string>;

/** What a state is called when it is said in words — a segment's title, a legend. */
export const SEGMENT_STATE_LABELS = {
  done: "done",
  active: "active",
  pending: "pending",
  skipped: "skipped",
  missing: "missing",
  unknown: "unknown",
  "opted-out": "opted out",
} satisfies Record<BarState, string>;

export const CHIP_CLASS = {
  done: "border-ok bg-ok-wash text-ok",
  active: "border-dusk bg-dusk-wash text-dusk",
  pending: "border-line bg-surface text-ink-faint",
  skipped: "border-line bg-ground text-ink-faint line-through",
  missing: "border-bad bg-bad-wash text-bad",
  unknown: "border-dotted border-ink-faint bg-surface text-ink-faint italic",
  "opted-out": "border-warn bg-warn-wash text-warn",
} satisfies Record<BarState, string>;

/**
 * `Test Phase 1` / `Phase 2` — the spelling the impl itself uses for a phase,
 * and the one the whole page speaks (Sandy's label direction at the U1
 * review: "Executing: Phase 4"). The package's `phaseLabel` says
 * `Build Phase 2`; that is the canonical name for logs and the headings
 * parser, not for the page (cleanup, A36). One spelling per audience, each
 * defined once.
 */
export function phaseTitle(phase: { kind: PhaseKind; number: number }): string {
  return `${phase.kind === "test" ? "Test Phase" : "Phase"} ${phase.number}`;
}

/** What each ritual's section calls itself, its rows and its items — the page and the copied markdown agree. */
export const RITUAL_COPY = {
  falsification: {
    title: "Falsification",
    rowsHeading: "Hypotheses",
    itemsHeading: "Fix items",
  },
  cleanup: {
    title: "Cleanup",
    rowsHeading: "New units under test",
    itemsHeading: "Decomposition",
  },
} satisfies Record<
  RitualWord,
  { title: string; rowsHeading: string; itemsHeading: string }
>;

/**
 * A promise's standing as the chip and the dashboard's row draw it: they have
 * four states, so a retired promise reads as declared (the mockups'
 * `chip` and `promise-row`).
 */
export const STANDING_BADGE = {
  broken: "broken",
  "being-proven": "proving",
  declared: "declared",
  enforced: "enforced",
  retired: "declared",
} as const satisfies Record<
  Standing,
  "declared" | "proving" | "enforced" | "broken"
>;

/** A mockup's approval as the Looks page's chip draws it (ui-promises ADR decision 3). */
export const APPROVAL_STYLE = {
  approved: "border-ok bg-surface text-ok",
  proposed: "border-dashed border-ink-faint bg-surface text-ink-soft",
} as const satisfies Record<"approved" | "proposed", string>;

/** A look's standing as the dashboard's row draws it (ui-promises ADR decision 7); the word is the package's. */
export const LOOK_STYLE = {
  broken: "border-bad bg-bad-wash text-bad",
  held: "border-ok bg-surface text-ok",
  unchecked: "border-line bg-surface text-ink-soft",
  uncovered: "border-dashed border-warn bg-warn-wash text-warn",
} as const satisfies Record<LookStanding, string>;
