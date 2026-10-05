import { violationState } from "@infinitedusky/indusk-mcp/promises/incidents";
import type { IncidentEntry } from "@infinitedusky/indusk-mcp/promises/registry";
import type {
  FullSlice,
  TimelineMark,
} from "@infinitedusky/indusk-mcp/promises/timeline";

/**
 * A promise's strip, computed (promise-timeline, ADR D6–D7). Pure: marks,
 * incidents, a window and a clock in, cells and bands out — so the drawing is
 * a rendering of this and nothing else.
 *
 * Each window is a fixed number of cells; each cell takes the worst state
 * among its runs — red (unrecorded or open) over purple (fixed) over green
 * (upheld) — and is empty when nothing ran. A violation's colour is its
 * incident's state, through `violationState`, the rule the chip shares.
 */

export const WINDOWS = {
  "24h": { ms: 24 * 3_600_000, cells: 96 },
  "7d": { ms: 7 * 86_400_000, cells: 84 },
  "30d": { ms: 30 * 86_400_000, cells: 90 },
} as const;
export type WindowKey = keyof typeof WINDOWS;
export const DEFAULT_WINDOW: WindowKey = "7d";

export function parseWindow(value: unknown): WindowKey {
  return typeof value === "string" && value in WINDOWS
    ? (value as WindowKey)
    : DEFAULT_WINDOW;
}

export type CellState = "red" | "purple" | "green" | "empty";

export interface StripCell {
  /** ISO start of the cell. */
  from: string;
  state: CellState;
  /** A read in this cell's time hit the query limit: there may be more runs. */
  atLeast: boolean;
  runs: number;
}

export interface StripBand {
  incident: string;
  from: string;
  to: string;
  open: boolean;
  /** Position within the strip, as fractions of its width. */
  left: number;
  width: number;
}

export interface Strip {
  window: WindowKey;
  cells: StripCell[];
  bands: StripBand[];
  /** "violated 3 d ago — open", when an unfixed break is older than the window; else null. */
  openBreak: string | null;
}

const RANK: Record<CellState, number> = {
  empty: 0,
  green: 1,
  purple: 2,
  red: 3,
};

function stateOf(mark: TimelineMark, incidents: IncidentEntry[]): CellState {
  if (mark.outcome === "upheld") return "green";
  return violationState(mark.traceId, incidents) === "fixed" ? "purple" : "red";
}

/** `90 m`, `3 h`, `2 d` — the largest whole unit. */
export function roughly(ms: number): string {
  if (ms >= 86_400_000) return `${Math.floor(ms / 86_400_000)} d`;
  if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)} h`;
  return `${Math.max(1, Math.floor(ms / 60_000))} m`;
}

export function buildStrip(input: {
  promise: string;
  marks: TimelineMark[];
  atLeast: FullSlice[];
  /** Every incident in the registry; the strip keeps this promise's. */
  incidents: IncidentEntry[];
  /** Marks older than the window, as far back as was read (the health window). */
  olderMarks?: TimelineMark[];
  window: WindowKey;
  now: number;
}): Strip {
  const { ms, cells: count } = WINDOWS[input.window];
  const start = input.now - ms;
  const cellMs = ms / count;
  const cells: StripCell[] = Array.from({ length: count }, (_, i) => ({
    from: new Date(start + i * cellMs).toISOString(),
    state: "empty" as CellState,
    atLeast: false,
    runs: 0,
  }));
  const indexOf = (t: number) =>
    Math.min(count - 1, Math.floor((t - start) / cellMs));

  for (const m of input.marks) {
    const t = Date.parse(m.at);
    if (t < start || t > input.now) continue;
    const cell = cells[indexOf(t)];
    const state = stateOf(m, input.incidents);
    if (RANK[state] > RANK[cell.state]) cell.state = state;
    cell.runs += 1;
  }
  for (const s of input.atLeast) {
    const from = Math.max(Date.parse(s.from), start);
    const to = Math.min(Date.parse(s.to), input.now);
    if (to < from) continue;
    for (let i = indexOf(from); i <= indexOf(to); i++) cells[i].atLeast = true;
  }

  const mine = input.incidents.filter((i) => i.promise === input.promise);
  const bands: StripBand[] = [];
  for (const i of mine) {
    if (!i.opened) continue;
    const from = Date.parse(i.opened);
    const to = i.fixed ? Date.parse(i.fixed) : input.now;
    if (to < start || from > input.now) continue;
    const left = Math.max(0, (from - start) / ms);
    const right = Math.min(1, (to - start) / ms);
    bands.push({
      incident: i.id,
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      open: i.status === "open",
      left,
      width: Math.max(right - left, 0.002),
    });
  }

  // The window decides what is drawn, never what is reported: an unfixed
  // break older than the window is still said.
  const older: number[] = [];
  for (const i of mine) {
    if (i.status === "open" && i.opened && Date.parse(i.opened) < start)
      older.push(Date.parse(i.opened));
  }
  for (const m of input.olderMarks ?? []) {
    const t = Date.parse(m.at);
    if (
      t < start &&
      m.outcome === "violated" &&
      stateOf(m, input.incidents) === "red"
    )
      older.push(t);
  }
  const newestOlder = older.length ? Math.max(...older) : null;
  return {
    window: input.window,
    cells,
    bands,
    openBreak:
      newestOlder === null
        ? null
        : `violated ${roughly(input.now - newestOlder)} ago — open`,
  };
}

/** What the page draws for one source and window: a strip per behaviour promise, or why there are none. */
export interface TimelineView {
  source: string;
  /** The sources the project has, for the source switch. */
  sources: string[];
  window: WindowKey;
  /** Per promise: its strip, or "empty" when no run marks it. */
  strips: Record<string, Strip | "empty">;
  /** Local's view: how far back its runs reach ("local history since …"). */
  reach: string | null;
  /** The source could not be read: said in place of its strips. */
  failure: string | null;
}
