import type { Proof, ProofDay } from "@infinitedusky/indusk-mcp/promises/proof";
import type { PromiseEntry } from "@infinitedusky/indusk-mcp/promises/registry";
import Link from "next/link";
import { STANDING_STYLE } from "@/components/bars/labels";
import { STANDING_LABELS } from "@/lib/promise-dashboard";
import { stamp } from "@/lib/stamp";
import { StartFix } from "./StartFix";

/**
 * The pieces of a promise's page (plan-cockpit, ADR decision 3): the banner,
 * four tiles, and the sections that show what proves the promise — every fact
 * from the package's `proofOf`, none worked out here.
 *
 * promise: a-promise-page-shows-its-proof
 */

/** `2026-10-10T07:00:00.000Z` as `2026-10-10 07:00`. */

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
      className={`flex flex-col gap-2 rounded border px-4 py-3 ${STANDING_STYLE[standing.standing].chip}`}
    >
      <p className="text-sm font-semibold">
        {STANDING_LABELS[standing.standing]}
        {standing.standing === "broken" && standing.lastBreak
          ? ` — last broken ${stamp(standing.lastBreak)}`
          : ""}
      </p>
      {proof.banner.testsMissTheCase ? (
        <p className="text-sm">
          Every test that names it passes: the tests miss the case that breaks
          it.
        </p>
      ) : null}
      {broken?.symptom ? (
        <p className="min-w-0 break-words text-sm">Symptom: {broken.symptom}</p>
      ) : null}
      {trace ? (
        <p className="min-w-0 break-all text-sm">
          Trace:{" "}
          <a href={trace} className="underline">
            {trace}
          </a>
        </p>
      ) : null}
      {broken ? (
        <StartFix project={project} promise={entry.name} plan={entry.owner} />
      ) : null}
    </section>
  );
}

export function PromiseTiles({ proof }: { proof: Proof }) {
  const { standing } = proof;
  const tiles: Array<[label: string, value: string]> = [
    ["Standing", STANDING_LABELS[standing.standing]],
    [
      "Tests",
      standing.tests.total === 0
        ? "none name it"
        : `${standing.tests.passing}/${standing.tests.total} passing`,
    ],
    [
      "Last seen",
      standing.lastActivity ? stamp(standing.lastActivity) : "not seen yet",
    ],
    [
      "Last 30 days",
      standing.thirtyDays.held === null
        ? "not seen yet"
        : `held ${standing.thirtyDays.held} · broke ${standing.thirtyDays.broke}`,
    ],
  ];
  return (
    <dl
      className="grid grid-cols-2 gap-2 md:grid-cols-4"
      data-testid="promise-tiles"
    >
      {tiles.map(([label, value]) => (
        <div
          key={label}
          className="min-w-0 rounded border border-gray-200 px-3 py-2"
        >
          <dt className="text-xs text-gray-500">{label}</dt>
          <dd className="break-words text-sm font-medium text-gray-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
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
    <section
      data-testid={`proof-${id}`}
      className="flex min-w-0 flex-col gap-2"
    >
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </section>
  );
}

const Files = ({ files }: { files: string[] }) =>
  files.length === 0 ? (
    <span className="text-gray-400">—</span>
  ) : (
    <ul className="flex flex-col gap-0.5">
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
        <p className="text-sm text-gray-600">No test row names it.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
          {proof.rows.map((r) => (
            <li
              key={`${r.plan}/${r.id}`}
              data-testid="proof-row"
              className="flex flex-col gap-1 px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-baseline gap-x-3">
                <code className="text-xs font-semibold">{r.id}</code>
                <span
                  className={
                    r.state === "passing" ? "text-green-700" : "text-amber-700"
                  }
                >
                  {r.state}
                </span>
                <Link
                  href={`${planHrefPrefix}${r.plan}`}
                  className="text-xs text-gray-500 hover:underline"
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
        <p role="alert" className="text-sm text-red-700">
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
        <p className="text-sm text-gray-600">
          It is not seen yet: no run of it has been marked in any source.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
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
              <span className="text-xs text-gray-600">
                {m.lastHeld ? `held ${stamp(m.lastHeld)}` : "never held"}
              </span>
              <span className="text-xs text-gray-600">
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
      <span className="text-xs text-gray-600">{source}</span>
      <div className="flex h-8 w-full gap-px">
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
              d.broken > 0
                ? "bg-red-600"
                : d.held > 0
                  ? "bg-green-600"
                  : "bg-gray-200"
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
            <p className="text-xs text-amber-700">
              {source}'s held days could not be read:{" "}
              {proof.unread[source as keyof typeof proof.unread]}
            </p>
          ) : null}
        </div>
      ))}
      <p className="text-xs text-gray-500">
        Red: a break was heard that day. Green: held. Grey: nothing seen.
      </p>
    </Section>
  );
}

export function PromiseHistory({ proof }: { proof: Proof }) {
  return (
    <Section id="history" title="History">
      {proof.history.length === 0 ? (
        <p className="text-sm text-gray-600">Nothing recorded yet.</p>
      ) : (
        <ol className="flex flex-col gap-1 text-sm">
          {proof.history.map((e) => (
            <li
              key={`${e.at}/${e.kind}/${e.text}`}
              data-testid="history-event"
              className="flex min-w-0 flex-wrap gap-x-3"
            >
              <span className="text-xs text-gray-500">{e.at}</span>
              <span className="text-xs font-medium text-gray-700">
                {e.kind}
              </span>
              <span className="min-w-0 break-words text-gray-900">
                {e.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

export function WhereItLives({ entry }: { entry: PromiseEntry }) {
  return (
    <Section id="lives" title="Where it lives">
      <dl className="grid gap-2 text-sm md:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs text-gray-500">Its file</dt>
          <dd>
            <Files files={[`.indusk/promises/${entry.file}`]} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-gray-500">Where it is kept in code</dt>
          <dd>
            <Files files={entry.sites} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-gray-500">Its tests</dt>
          <dd>
            <Files files={entry.tests} />
          </dd>
        </div>
      </dl>
    </Section>
  );
}
