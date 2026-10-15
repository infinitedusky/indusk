import type { Proof, ProofDay } from "@infinitedusky/indusk-mcp/promises/proof";
import type { PromiseEntry } from "@infinitedusky/indusk-mcp/promises/registry";
import Link from "next/link";
import { STANDING_BADGE } from "@/components/bars/labels";
import { Badge } from "@/components/ui/Badge";
import { Box } from "@/components/ui/Box";
import { DecisionCard } from "@/components/ui/DecisionCard";
import { Stat } from "@/components/ui/Stat";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { STANDING_LABELS } from "@/lib/promise-dashboard";
import { stamp } from "@/lib/stamp";
import { StartFix } from "./StartFix";

/**
 * The pieces of a promise's page (plan-cockpit, ADR decision 3): the banner,
 * three tiles (tests, held, broken), and the sections that show what proves the promise — every fact
 * from the package's `proofOf`, none worked out here.
 *
 * promise: a-promise-page-shows-its-proof
 */

export function PromiseBanner({
  proof,
  entry,
  project,
}: {
  proof: Proof;
  entry: PromiseEntry;
  project: string;
}) {
  const { standing, broken } = proof;
  const trace =
    broken?.traceId &&
    `${broken.sourceLabel.replace(/\/+$/, "")}/trace/${broken.traceId}`;
  return (
    <section
      data-testid="promise-banner"
      data-standing={standing.standing}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-faint">
        <Badge variant={STANDING_BADGE[standing.standing]}>
          {STANDING_LABELS[standing.standing]}
        </Badge>
        {standing.standing === "broken" && standing.lastBreak ? (
          <span>last broken {stamp(standing.lastBreak)}</span>
        ) : null}
        <span>
          {standing.lastActivity
            ? `seen ${stamp(standing.lastActivity)}`
            : "not seen yet"}
        </span>
      </div>
      {broken ? (
        <DecisionCard tone="alert">
          {proof.banner.testsMissTheCase ? (
            <p>
              Every test that names it passes: the tests miss the case that
              breaks it.
            </p>
          ) : null}
          {broken.symptom ? (
            <p className="min-w-0 break-words">Symptom: {broken.symptom}</p>
          ) : null}
          {trace ? (
            <p className="min-w-0 break-all">
              Trace:{" "}
              <a href={trace} className="underline">
                {trace}
              </a>
            </p>
          ) : null}
          <StartFix project={project} promise={entry.name} plan={entry.owner} />
        </DecisionCard>
      ) : null}
    </section>
  );
}

export function PromiseTiles({ proof }: { proof: Proof }) {
  const { standing } = proof;
  const { held, broke } = standing.thirtyDays;
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-4"
      data-testid="promise-tiles"
    >
      <Stat
        label="Tests"
        value={
          standing.tests.total === 0
            ? "none"
            : `${standing.tests.passing}/${standing.tests.total}`
        }
        note={standing.tests.total === 0 ? "none name it" : "passing"}
      />
      <Stat
        label="Held"
        value={held === null ? "–" : String(held)}
        note={held === null ? "not seen yet" : "last 30 days"}
        tone={held ? "ok" : undefined}
      />
      <Stat
        label="Broken"
        value={held === null ? "–" : String(broke)}
        note={held === null ? "not seen yet" : "last 30 days"}
        tone={broke ? "bad" : undefined}
      />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box data-testid={`proof-${id}`} title={title}>
      {children}
    </Box>
  );
}

const Files = ({ files }: { files: string[] }) =>
  files.length === 0 ? (
    <span className="text-ink-faint">—</span>
  ) : (
    <ul className="flex flex-col gap-hair">
      {files.map((f) => (
        <li key={f} className="min-w-0 break-all">
          <code className="text-xs">{f}</code>
        </li>
      ))}
    </ul>
  );

export function TestsThatBackIt({
  proof,
  planHrefPrefix,
}: {
  proof: Proof;
  planHrefPrefix: string;
}) {
  return (
    <Section id="tests" title="Tests that back it">
      {proof.rows.length === 0 ? (
        <p className="text-sm text-ink-soft">No test row names it.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {proof.rows.map((r) => (
            <li
              key={`${r.plan}/${r.id}`}
              data-testid="proof-row"
              className="flex flex-col gap-1 px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <code className="text-xs font-semibold">{r.id}</code>
                <span
                  className={r.state === "passing" ? "text-ok" : "text-warn"}
                >
                  {r.state}
                </span>
                <Link
                  href={`${planHrefPrefix}${r.plan}`}
                  className="text-xs text-ink-faint hover:underline"
                >
                  {r.plan}
                  {r.archived ? " (archived)" : ""}
                </Link>
              </span>
              <Files files={r.tests} />
            </li>
          ))}
        </ul>
      )}
      {proof.unreadable.length > 0 ? (
        <p role="alert" className="text-sm text-bad">
          Could not read the tests of {proof.unreadable.join(", ")}: a missing
          row there is not a missing test.
        </p>
      ) : null}
    </Section>
  );
}

export function WhereItIsWatched({ proof }: { proof: Proof }) {
  return (
    <Section id="marks" title="Where it is watched">
      {proof.marks.length === 0 ? (
        <p className="text-sm text-ink-soft">
          It is not seen yet: no run of it has been marked in any source.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {proof.marks.map((m) => (
            <li
              key={`${m.service}/${m.operation}`}
              data-testid="proof-mark"
              className="flex flex-wrap items-baseline gap-x-4 px-3 py-2 text-sm"
            >
              <span className="min-w-0 break-all">
                <code className="text-xs">{m.service}</code>{" "}
                <code className="text-xs">{m.operation}</code>
              </span>
              <span className="text-xs text-ink-soft">
                {m.lastHeld ? `held ${stamp(m.lastHeld)}` : "never held"}
              </span>
              <span className="text-xs text-ink-soft">
                {m.lastBroken
                  ? `broken ${stamp(m.lastBroken)}`
                  : "never broken"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DayBars({ source, days }: { source: string; days: ProofDay[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-ink-soft">{source}</span>
      <div className="flex h-8 w-full gap-hair">
        {days.map((d) => (
          <span
            key={d.day}
            data-testid="day-bar"
            data-source={source}
            data-day={d.day}
            data-broken={String(d.broken > 0)}
            data-count={d.broken}
            title={`${d.day}: held ${d.held}, broke ${d.broken}`}
            className={`min-w-0 flex-1 rounded-sm ${
              d.broken > 0 ? "bg-bad" : d.held > 0 ? "bg-ok" : "bg-idle-wash"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function LastThirtyDays({ proof }: { proof: Proof }) {
  const sources = Object.entries(proof.days) as Array<[string, ProofDay[]]>;
  return (
    <Section id="days" title="Last thirty days">
      {sources.map(([source, days]) => (
        <div key={source} className="flex flex-col gap-1">
          <DayBars source={source} days={days} />
          {proof.unread[source as keyof typeof proof.unread] ? (
            <p className="text-xs text-warn">
              {source}'s held days could not be read:{" "}
              {proof.unread[source as keyof typeof proof.unread]}
            </p>
          ) : null}
        </div>
      ))}
      <p className="text-xs text-ink-faint">
        Red: a break was heard that day. Green: held. Grey: nothing seen.
      </p>
    </Section>
  );
}

const EVENT_TONE: Partial<
  Record<Proof["history"][number]["kind"], "good" | "bad">
> = { incident: "bad", fixed: "good", confirmed: "good" };

export function PromiseHistory({ proof }: { proof: Proof }) {
  const items: TimelineItem[] = proof.history.map((e) => ({
    when: e.at,
    what: `${e.kind}: ${e.text}`,
    tone: EVENT_TONE[e.kind],
  }));
  return (
    <Section id="history" title="History">
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing recorded yet.</p>
      ) : (
        <Timeline items={items} />
      )}
    </Section>
  );
}

export function WhereItLives({ entry }: { entry: PromiseEntry }) {
  return (
    <Section id="lives" title="Where it lives">
      <dl className="grid gap-2 text-sm md:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-ink-faint">Its file</dt>
          <dd>
            <Files files={[`.indusk/promises/${entry.file}`]} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-faint">Where it is kept in code</dt>
          <dd>
            <Files files={entry.sites} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-ink-faint">Its tests</dt>
          <dd>
            <Files files={entry.tests} />
          </dd>
        </div>
      </dl>
    </Section>
  );
}
