import type { CellState, Strip } from "@/lib/timeline-strip";

/**
 * A promise's history as a strip of cells (promise-timeline, ADR D6): time
 * left to right, each cell the worst state among its runs, each incident a
 * band beneath from when it opened to when it was fixed. A rendering of
 * `buildStrip` and nothing else; no hooks, so it draws on the server.
 */

const CELL: Record<CellState, string> = {
  red: "bg-red-600",
  purple: "bg-purple-600",
  green: "bg-green-600",
  empty: "bg-gray-100",
};

const SAID: Record<CellState, string> = {
  red: "violated — unfixed",
  purple: "violated — fixed",
  green: "upheld",
  empty: "no runs",
};

export function PromiseTimeline({
  promise,
  source,
  strip,
}: {
  promise: string;
  source: string;
  strip: Strip;
}) {
  return (
    <div className="flex w-full flex-col gap-0.5">
      <div
        className="flex h-3 w-full gap-px"
        data-testid="promise-timeline"
        data-promise={promise}
        data-source={source}
        data-window={strip.window}
      >
        {strip.cells.map((c) => (
          <span
            key={c.from}
            data-testid="timeline-cell"
            data-state={c.state}
            data-from={c.from}
            {...(c.atLeast ? { "data-at-least": "" } : {})}
            title={`${c.from.slice(0, 16).replace("T", " ")} — ${SAID[c.state]}${c.runs ? ` (${c.atLeast ? "at least " : ""}${c.runs} run${c.runs === 1 ? "" : "s"})` : ""}`}
            className={`h-full flex-1 rounded-[1px] ${CELL[c.state]} ${c.atLeast ? "opacity-70" : ""}`}
          />
        ))}
      </div>
      {strip.bands.length > 0 && (
        <div className="relative h-1.5 w-full">
          {strip.bands.map((b) => (
            <span
              key={b.incident}
              data-testid="incident-band"
              data-incident={b.incident}
              data-from={b.from}
              data-to={b.to}
              title={`${b.incident}: ${b.open ? "open" : "fixed"}`}
              className={`absolute top-0 h-full rounded-sm ${b.open ? "bg-red-300" : "bg-purple-300"}`}
              style={{ left: `${b.left * 100}%`, width: `${b.width * 100}%` }}
            />
          ))}
        </div>
      )}
      {strip.openBreak && (
        <span
          className="text-xs font-medium text-red-700"
          data-testid="open-break"
        >
          {strip.openBreak}
        </span>
      )}
    </div>
  );
}

/** A behaviour promise no run marks: said, never drawn as an empty strip that reads as healthy. */
export function TimelineEmpty() {
  return (
    <span className="text-xs text-gray-500" data-testid="timeline-empty">
      no runs mark this promise
    </span>
  );
}
