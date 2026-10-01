import {
  documentFor,
  PLAN_POSITIONS,
  type PlanPositionState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import {
  absentDocumentNote,
  type WorkflowType,
} from "@infinitedusky/indusk-mcp/workflow-types";
import { Bar, type BarSegment } from "./Bar";
import { POSITION_LABELS } from "./labels";

/**
 * The plan bar: every lifecycle position, research through archived, with
 * the current one active and labelled with what it awaits. The same steps on
 * every plan whether reached or not — the bar doubles as the definition of
 * what a plan requires (Sandy, 2026-09-16) — so two plans at different
 * positions have bars of the same shape.
 *
 * An absent document is drawn by what the plan's type says about it
 * (admin-plan-type): skipped when the type does not require it, missing when
 * it does and the plan moved past it, unknown when no type is declared. The
 * last two are also said in a sentence under the bar. A gap that only a
 * colour reports is a gap nobody reads.
 *
 * When the plan is executing, the label is pulled up from the phase bar:
 * "executing: verifying Build Phase 2".
 */
export function PlanBar({
  position,
  activity,
  workflow = null,
  declared = null,
}: {
  position: PlanPositionState;
  /** The active phase's verb and name, when the plan is executing. */
  activity?: string | null;
  /** The plan's declared type, which is what makes a document missing rather than skipped. */
  workflow?: WorkflowType | null;
  /** The word the plan declared, when it is not one of the types — so the sentence can say so. */
  declared?: string | null;
}) {
  // Every segment is a step, drawn half-filled when active — except
  // `monitor`, which is time: it fills with the share of the quiet window
  // that has passed (day-monitor, ADR D8).
  const monitor = position.monitor;
  const segments: BarSegment[] = PLAN_POSITIONS.map((key) => ({
    key,
    state: position.segments[key],
    label: POSITION_LABELS[key],
    fill:
      key === "monitor" && monitor
        ? Math.min(1, monitor.elapsedDays / monitor.windowDays)
        : 0.5,
  }));
  const activeLabel =
    position.position === "executing" && activity
      ? `executing: ${activity}`
      : position.awaiting;
  const notes = documentNotes(position, workflow, declared);
  return (
    <div className="flex flex-col gap-1">
      <Bar
        segments={segments}
        activeLabel={activeLabel}
        caption={
          monitor
            ? "steps, then time: monitor fills as the quiet window passes"
            : "steps, not time"
        }
        testId="plan-bar"
        labels
      />
      {notes.length > 0 ? (
        <ul
          className="flex flex-col gap-0.5 text-xs"
          data-testid="plan-bar-document-notes"
        >
          {notes.map((note) => (
            <li
              key={note.document}
              data-document={note.document}
              data-state={note.state}
              className={
                note.state === "missing" ? "text-red-700" : "text-gray-600"
              }
            >
              {note.text}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

interface DocumentNote {
  document: string;
  state: "missing" | "unknown";
  text: string;
}

/**
 * One sentence per document that is missing or cannot be judged. Skipped
 * documents get none: they are absent by design, and a note for each would
 * bury the ones that matter.
 */
function documentNotes(
  position: PlanPositionState,
  workflow: WorkflowType | null,
  declared: string | null,
): DocumentNote[] {
  const notes: DocumentNote[] = [];
  for (const key of PLAN_POSITIONS) {
    const state = position.segments[key];
    if (state !== "missing" && state !== "unknown") continue;
    const document = documentFor(key);
    if (document === null) continue;
    notes.push({
      document,
      state,
      text: absentDocumentNote(document, state, workflow, declared),
    });
  }
  return notes;
}
