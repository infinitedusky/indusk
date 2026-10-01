import {
  type BarState,
  SEGMENT_CLASS,
  SEGMENT_FRAME_CLASS,
  SEGMENT_LABEL_CLASS,
  SEGMENT_STATE_LABELS,
} from "./labels";

/**
 * The one bar primitive the three progress bars are built on.
 *
 * Every segment is tri-state plus opt-out (Sandy, 2026-09-16): done segments
 * are full, pending ones empty, skipped ones drawn empty but present — so a
 * bar's shape is constant across plans — and the active segment is partially
 * filled and carries the message. Fill says how far; the label says what is
 * happening. Segments are equal width: this is a checklist, not a time
 * estimate, and the caption slot is where a bar says so.
 *
 * An absent document has three readings, each with its own frame
 * (admin-plan-type): skipped is dashed, missing is a solid red outline,
 * unknown is dotted. Those three also say their state in the segment's title,
 * because an empty box says nothing on its own.
 */

/** The states whose meaning an empty segment cannot carry by itself. */
const SAID_IN_WORDS: ReadonlySet<BarState> = new Set([
  "skipped",
  "missing",
  "unknown",
]);

function segmentTitle(segment: BarSegment): string {
  return SAID_IN_WORDS.has(segment.state)
    ? `${segment.label} — ${SEGMENT_STATE_LABELS[segment.state]}`
    : segment.label;
}

export interface BarSegment {
  key: string;
  state: BarState;
  /** Shown on hover — the segment's name and, for an active one, its progress. */
  label: string;
  /** How much of an active segment is filled, 0–1. Ignored for other states. */
  fill?: number;
  /** The word under the segment when labels are shown; defaults to `label`. */
  short?: string;
}

export interface BarProps {
  segments: BarSegment[];
  /** The one thing happening now — rendered under the bar. */
  activeLabel?: string | null;
  caption?: string;
  testId: string;
  /** Render each segment's short label under it — the bar reads without hovering. */
  labels?: boolean;
}

function fillPercent(segment: BarSegment): number {
  switch (segment.state) {
    case "done":
    case "opted-out":
      return 100;
    case "active":
      return Math.round(Math.min(1, Math.max(0, segment.fill ?? 0.5)) * 100);
    default:
      return 0;
  }
}

export function Bar({
  segments,
  activeLabel,
  caption,
  testId,
  labels = false,
}: BarProps) {
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <ol className="flex w-full gap-0.5" aria-label={testId}>
        {segments.map((segment) => (
          <li
            key={segment.key}
            data-segment={segment.key}
            data-state={segment.state}
            title={segmentTitle(segment)}
            className={`h-2 flex-1 overflow-hidden rounded-sm ${SEGMENT_FRAME_CLASS[segment.state]}`}
          >
            <span
              className={`block h-full ${SEGMENT_CLASS[segment.state]}`}
              style={{ width: `${fillPercent(segment)}%` }}
            />
          </li>
        ))}
      </ol>
      {labels ? (
        <ol className="flex w-full gap-0.5" aria-hidden="true">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className={`min-w-0 flex-1 truncate text-center text-[9px] leading-3 ${SEGMENT_LABEL_CLASS[segment.state]}`}
            >
              {segment.short ?? segment.label}
            </li>
          ))}
        </ol>
      ) : null}
      {activeLabel ? (
        <p
          className="text-xs text-gray-700"
          data-testid={`${testId}-active-label`}
        >
          {activeLabel}
        </p>
      ) : null}
      {caption ? (
        <p
          className="text-[10px] text-gray-400"
          data-testid={`${testId}-caption`}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}
