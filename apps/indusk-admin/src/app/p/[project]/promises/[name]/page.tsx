import {
  planTitle,
  promiseWords,
  readHealthNames,
} from "@infinitedusky/indusk-mcp/promises/display";
import { proofOf } from "@infinitedusky/indusk-mcp/promises/proof";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  LastThirtyDays,
  PromiseBanner,
  PromiseHistory,
  PromiseTiles,
  TestsThatBackIt,
  WhereItIsWatched,
  WhereItLives,
} from "@/components/promise/PromiseProof";
import { Box } from "@/components/ui/Box";
import { startPage } from "@/lib/page-reads";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";
import { standingKept } from "@/lib/standing-kept";

interface PromisePageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * A promise's own page — `/p/{project}/promises/{name}` (plan-cockpit, ADR
 * decision 3): its sentence in words, whether it is broken and what to do,
 * and what proves it — the tests that name it, where it is watched, thirty
 * days, its history. Every fact is the package's `proofOf`; this page lays it
 * out. Live like the dashboard it is opened from.
 *
 * The stale-project case is the layout's, as the plan page's is; a name the
 * registry does not hold is `notFound()`.
 *
 * promise: a-promise-page-shows-its-proof
 */
export default async function PromisePage({ params }: PromisePageProps) {
  const { project, name } = await params;
  const projectPath = getProjectPath(project);
  const page = startPage("promise", projectPath ?? "");
  if (!projectPath || !projectPathExists(projectPath)) return null;

  // The daemon is found from the kept process list, not a `ps` of this page's own.
  await page.reads({ processList: true });
  const registry = registryOf(readProjectPromises(projectPath));
  const entry = registry?.promises.find(
    (p) => p.name === name || p.aliases.includes(name),
  );
  const proof = entry
    ? await proofOf(projectPath, entry.name, {
        cacheMs: readAdminRefreshMs(projectPath),
      })
    : null;
  if (!registry || !entry || !proof) notFound();

  const names = await standingKept(`health-names:${projectPath}`, () =>
    readHealthNames(projectPath),
  );
  const sentenceOf = (n: string) => promiseWords(n, names.words);
  const planHrefPrefix = `/p/${project}/plan/`;
  const beside = registry.promises.filter(
    (p) => p.owner === entry.owner && p.name !== entry.name,
  );
  page.finish(0);

  return (
    <div className="flex min-w-0 flex-col gap-5" data-testid="promise-page">
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      <header className="flex min-w-0 flex-col gap-1">
        <Link
          href={`/p/${project}/promises`}
          className="text-xs text-ink-faint hover:underline"
        >
          Promises
        </Link>
        <h1 className="break-words text-xl font-semibold text-ink">
          {sentenceOf(entry.name)}
        </h1>
        <p className="break-words text-sm text-ink-soft">{entry.statement}</p>
        <p className="flex flex-wrap gap-x-3 text-xs text-ink-faint">
          <code>{entry.name}</code>
          <Link
            href={`${planHrefPrefix}${entry.owner}`}
            className="hover:underline"
          >
            {names.planTitles[entry.owner] ??
              planTitle(undefined, entry.owner, names.words)}
          </Link>
        </p>
      </header>
      <PromiseBanner proof={proof} entry={entry} project={project} />
      <PromiseTiles proof={proof} />
      <div className="cols-promise-page grid items-start gap-5">
        <div className="flex min-w-0 flex-col gap-5">
          <TestsThatBackIt proof={proof} planHrefPrefix={planHrefPrefix} />
          <WhereItIsWatched proof={proof} />
          <LastThirtyDays proof={proof} />
          <PromiseHistory proof={proof} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {beside.length > 0 && (
            <Box title="Same plan" data-testid="proof-same-plan">
              <ul className="flex flex-col gap-1 text-sm">
                {beside.map((p) => (
                  <li key={p.name} className="min-w-0 break-words">
                    <Link
                      href={`/p/${project}/promises/${p.name}`}
                      className="hover:underline"
                    >
                      {sentenceOf(p.name)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Box>
          )}
          <WhereItLives entry={entry} />
        </div>
      </div>
    </div>
  );
}
