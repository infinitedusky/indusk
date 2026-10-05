import Link from "next/link";
import type {
  CellState,
  Strip,
  TimelineView,
  WindowKey,
} from "@/lib/timeline-strip";

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

const WINDOW_LABELS: Record<WindowKey, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

/** One choice in a switch: a link, or plain bold text when it is the current one. */
function SwitchLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "true" : undefined}
      className={
        current
          ? "font-semibold text-gray-900"
          : "text-blue-700 hover:underline"
      }
    >
      {children}
    </Link>
  );
}

/**
 * The timeline's window and source switches, how far back the read reaches,
 * and a failed source said in place of its strips (promise-timeline, ADR D6).
 * Links, not state: the choice lives in the URL, so the page's refresh keeps it.
 */
export function TimelineControls({
  timelines,
  path,
}: {
  timelines: TimelineView;
  path: string;
}) {
  const href = (change: { window?: string; source?: string }) =>
    `${path}?${new URLSearchParams({
      window: change.window ?? timelines.window,
      source: change.source ?? timelines.source,
    })}`;
  return (
    <div className="flex flex-col gap-1" data-testid="timeline-controls">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">History:</span>
        {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((w) => (
          <SwitchLink
            key={w}
            href={href({ window: w })}
            current={timelines.window === w}
          >
            {WINDOW_LABELS[w]}
          </SwitchLink>
        ))}
        {timelines.sources.length > 1 && (
          <>
            <span className="ml-4 text-gray-600">Source:</span>
            {timelines.sources.map((s) => (
              <SwitchLink
                key={s}
                href={href({ source: s })}
                current={timelines.source === s}
              >
                {s}
              </SwitchLink>
            ))}
          </>
        )}
      </div>
      {timelines.reach && (
        <p className="text-xs text-gray-500" data-testid="timeline-reach">
          {timelines.reach}
        </p>
      )}
      {timelines.failure && (
        <p
          className="rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          data-testid="timeline-failure"
        >
          {timelines.failure}
        </p>
      )}
    </div>
  );
}
