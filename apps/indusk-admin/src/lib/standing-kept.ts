import { KEPT_FOR_MS } from "@infinitedusky/indusk-mcp/run-record";

/**
 * The standing of a project's promises for a page, without the page waiting on the telemetry
 * query behind it (admin-pages-load-fast, decision 22). Reading a standing asks the local
 * Jaeger for thirty days of marks, which takes from a second to several when it is busy or
 * answers an error; the nav's broken count and the Promises page's rows do not need that
 * second, they need the last answer and a newer one on the way.
 *
 * The last good answer is served at once while it is younger than `STALE_FOR_MS`; once it is
 * older than the kept window a single refresh runs behind it (shared by every page that asks
 * meanwhile). A project with no answer yet, or only one older than `STALE_FOR_MS`, waits for the
 * read. A failed read is never kept: the old answer keeps serving until it is too old, then the
 * failure reaches the page as it always did.
 *
 * clause: admin-pages-load-fast/never-freezes
 */
export const STALE_FOR_MS = 60_000;

interface Held<T> {
  rows: T;
  at: number;
}

const held = new Map<string, Held<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function resetStandingKept(): void {
  held.clear();
  inFlight.clear();
}

export async function standingKept<T>(
  key: string,
  read: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const refresh = (): Promise<T> => {
    const running = inFlight.get(key);
    if (running) return running as Promise<T>;
    const started = (async () => {
      try {
        const rows = await read();
        held.set(key, { rows, at: now() });
        return rows;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, started);
    return started;
  };
  const last = held.get(key) as Held<T> | undefined;
  if (!last || now() - last.at > STALE_FOR_MS) return refresh();
  if (now() - last.at >= KEPT_FOR_MS) refresh().catch(() => {});
  return last.rows;
}
