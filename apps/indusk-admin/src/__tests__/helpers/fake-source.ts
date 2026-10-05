import type { Registry } from "@infinitedusky/indusk-mcp/promises/registry";
import {
  JaegerUnreachable,
  type MarkSource,
  type ProbedSource,
  type ResolvedSource,
  type SourceName,
  WatcherBlind,
} from "@infinitedusky/indusk-mcp/promises/sources";
import type {
  ReadTimelineOptions,
  TimelineMark,
  TimelineRead,
} from "@infinitedusky/indusk-mcp/promises/timeline";
import type { HealthDeps } from "@/lib/promise-health";

/**
 * Sources answered from lists of runs, and a clock the test moves (test-kinds,
 * ADR D2). What the admin's store and health read need from Jaeger — resolve a
 * source, read a range, probe the watcher — without a Jaeger, a `next dev` or
 * a wait, so a rule about late runs or a slow window is checked in
 * milliseconds.
 *
 * Runs belong to a server (its label), not to a source name: repointing a
 * source at another server shows that server's runs.
 */

export interface Run {
  promise: string;
  outcome: "upheld" | "violated";
  /** When the run ended, ms since the epoch. */
  at: number;
  traceId?: string;
  environment?: string | null;
}

export interface FakeSource {
  deps: Required<HealthDeps>;
  /** The test's clock. */
  clock: { now: number };
  /** A run reaching `source`'s current server now, dated `run.at`. */
  add(source: SourceName, run: Run): void;
  /** Point `source` at another server (by its label). */
  repoint(source: SourceName, label: string): void;
  /** Every range `read` was asked for, in order. */
  ranges: Array<{ source: SourceName; from: number; to: number }>;
  /** Each read of a range longer than `overMs` costs `costMs` of clock. */
  slow(overMs: number, costMs: number): void;
  /** `source` cannot be reached. */
  fail(source: SourceName): void;
  /** `source`'s watcher answers and hears nothing. */
  blind(source: SourceName): void;
}

let traces = 0;
const traceId = () => (++traces).toString(16).padStart(32, "0");

export function fakeSource(opts: {
  now: number;
  sources?: SourceName[];
}): FakeSource {
  const clock = { now: opts.now };
  const names = opts.sources ?? ["production"];
  const labels = new Map<SourceName, string>(
    names.map((n) => [n, `http://${n}.test:16686`]),
  );
  const runs = new Map<string, TimelineMark[]>();
  const failing = new Set<SourceName>();
  const deaf = new Set<SourceName>();
  const ranges: FakeSource["ranges"] = [];
  let slowness: { overMs: number; costMs: number } | null = null;

  const label = (name: SourceName) => labels.get(name) ?? name;
  const source = (name: SourceName): MarkSource => ({
    name,
    endpoint: {} as MarkSource["endpoint"],
    label: label(name),
    remote: name === "production",
    intakeUrl: `${label(name)}/otlp`,
  });

  const resolve = async (): Promise<ResolvedSource[]> =>
    names.map((name) =>
      failing.has(name)
        ? {
            name,
            ok: false,
            error: new JaegerUnreachable(label(name), "connection refused"),
          }
        : { name, ok: true, source: source(name) },
    );

  const read = async (
    _root: string,
    reg: Registry,
    o: ReadTimelineOptions,
  ): Promise<TimelineRead[]> => {
    const name = o.source ?? "production";
    const from = o.from.getTime();
    const to = o.to.getTime();
    ranges.push({ source: name, from, to });
    if (slowness && to - from > slowness.overMs) clock.now += slowness.costMs;
    if (failing.has(name)) {
      return [
        {
          name,
          label: label(name),
          ok: false,
          kind: "unreachable",
          where: label(name),
          reason: "connection refused",
        },
      ];
    }
    const held = runs.get(label(name)) ?? [];
    const byPromise = new Map(
      reg.promises
        .filter((p) => p.kind === "behaviour" && p.state !== "retired")
        .map((p) => [
          p.name,
          {
            marks: held
              .filter((m) => {
                const t = Date.parse(m.at);
                return (
                  (m as TimelineMark & { promise: string }).promise ===
                    p.name &&
                  t >= from &&
                  t <= to
                );
              })
              .map(({ at, outcome, traceId: id, environment }) => ({
                at,
                outcome,
                traceId: id,
                environment,
              })),
            atLeast: [],
          },
        ]),
    );
    return [
      {
        name,
        label: label(name),
        ok: true,
        from: o.from.toISOString(),
        to: o.to.toISOString(),
        byPromise,
      },
    ];
  };

  const probe = async (): Promise<ProbedSource[]> =>
    names.map((name): ProbedSource => {
      if (failing.has(name)) {
        const error = new JaegerUnreachable(label(name), "connection refused");
        return {
          name,
          label: label(name),
          ok: false,
          kind: "unreachable",
          where: label(name),
          reason: error.message,
          error,
        };
      }
      if (deaf.has(name)) {
        const error = new WatcherBlind(
          label(name),
          `${label(name)}/otlp`,
          "the probe span never came back",
        );
        return {
          name,
          label: label(name),
          ok: false,
          kind: "blind",
          where: label(name),
          reason: error.reason,
          error,
        };
      }
      return { name, label: label(name), ok: true };
    });

  return {
    deps: { now: () => clock.now, resolve, read, probe },
    clock,
    add(name, run) {
      const list = runs.get(label(name)) ?? [];
      list.push({
        promise: run.promise,
        at: new Date(run.at).toISOString(),
        outcome: run.outcome,
        traceId: run.traceId ?? traceId(),
        environment: run.environment ?? null,
      } as TimelineMark & { promise: string });
      runs.set(label(name), list);
    },
    repoint(name, to) {
      labels.set(name, to);
    },
    ranges,
    slow(overMs, costMs) {
      slowness = { overMs, costMs };
    },
    fail(name) {
      failing.add(name);
    },
    blind(name) {
      deaf.add(name);
    },
  };
}
