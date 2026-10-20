import { Markdown } from "@/components/Markdown";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type { Scorecard } from "@/lib/planning-reader";

/**
 * Scorecard rendering. Used by the global /scorecards page (every scorecard
 * from each project's results log in its home, framed as a system-improvement signal,
 * not as plan-specific data).
 *
 * Per the user's framing: scorecards are not relevant to any individual plan
 * — they're a feedback loop on the whole system. The `/scorecards` page is
 * the place where they live; PlanDetail no longer renders them.
 */

interface ScorecardQuestion {
  id?: string;
  question?: string;
  answer?: string;
  severity?: string;
  evidence?: string;
  finding?: string;
}

export interface ScorecardsListProps {
  scorecards: Scorecard[];
  /**
   * Optional commit message per commit ID. Surfaces the human-authored
   * intent of the commit alongside the LLM-generated summary — the real
   * "what was being scored" signal. Resolved by `getCommitMessages` in
   * `src/lib/vcs.ts`.
   */
  descriptions?: Map<string, string>;
  /** How many scorecards the log holds when `scorecards` is only the latest of them. */
  total?: number;
}

export function ScorecardsList({
  scorecards,
  descriptions,
  total,
}: ScorecardsListProps) {
  // Most-recent-first sort (ISO 8601 timestamps sort lexicographically in
  // reverse). Done here so the page-level walker can pass an unsorted
  // union of per-project entries — the list owns the ordering contract.
  const sorted = [...scorecards].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
  return (
    <section className="flex flex-col gap-4" data-testid="scorecards-list">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-ink">Eval Scorecards</h1>
        <p className="text-sm text-ink-soft">
          Per-commit scores produced by the eval agent on every{" "}
          <code className="rounded-md bg-idle-wash px-1 text-xs font-mono">
            git commit
          </code>
          . This is a self-improvement signal — what worked, what didn't, what
          the system could improve. Not tied to any single plan.
        </p>
        <p className="text-xs text-ink-faint">
          Source: <span className="font-mono">eval/results.log</span> in each
          project's home across every registered project (
          {total !== undefined && total > sorted.length
            ? `latest ${sorted.length} of ${total}`
            : sorted.length}{" "}
          entries, most recent first)
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-ink-faint" data-testid="scorecards-empty">
          No scorecards yet — make a few{" "}
          <code className="font-mono">git commit</code>s inside Claude Code, and
          they'll start appearing.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((card) => (
            <ScorecardCard
              key={`${card.timestamp}-${card.changeId ?? "unknown"}-${card.project ?? ""}`}
              card={card}
              commitMessage={
                card.changeId
                  ? descriptions?.get(String(card.changeId))
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScorecardCard({
  card,
  commitMessage,
}: {
  card: Scorecard;
  commitMessage?: string;
}) {
  const status = card.error ? "error" : "ok";
  const llmSummary =
    (card.summary as string | undefined) ??
    (card.message as string | undefined);
  // Prefer the actual commit message when we have it — it's the human-
  // authored intent of the commit being scored. Fall back to the LLM-
  // generated summary, then to a placeholder.
  const headerLine =
    commitMessage?.split("\n")[0]?.trim() || llmSummary || "(no description)";
  const questions = Array.isArray(card.questions)
    ? (card.questions as ScorecardQuestion[])
    : [];
  const titleNode = (
    <span className="flex flex-1 items-center gap-2 truncate">
      <span className="text-xs text-ink-faint font-mono shrink-0">
        {formatTimestamp(card.timestamp)}
      </span>
      {card.project ? (
        <Badge
          variant="neutral"
          data-testid="scorecard-project-label"
          className="shrink-0"
        >
          {card.project}
        </Badge>
      ) : null}
      <span className="text-xs text-ink-faint font-mono shrink-0">
        {(card.changeId ?? "—").slice(0, 8)}
      </span>
      <span className="text-sm text-ink truncate">{headerLine}</span>
    </span>
  );
  const headerRight = (
    <span className="flex items-center gap-2">
      {card.mode ? (
        <span className="text-xs text-ink-faint">{String(card.mode)}</span>
      ) : null}
      <Badge variant={status === "error" ? "blocked" : "passing"}>
        {status === "error" ? "✗ error" : "✓ ok"}
      </Badge>
    </span>
  );
  return (
    <CollapsibleSection
      title={titleNode}
      headerRight={headerRight}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-3">
        {commitMessage && (
          <section
            className="rounded-md border border-dusk bg-dusk-wash p-3"
            data-testid="scorecard-commit-message"
          >
            <h3 className="text-xs font-semibold uppercase tracking-caps text-dusk">
              Commit message
            </h3>
            <pre className="mt-1 text-sm text-ink whitespace-pre-wrap font-sans">
              {commitMessage}
            </pre>
          </section>
        )}
        <ScorecardMeta card={card} />
        {questions.length > 0 && <ScorecardQuestions questions={questions} />}
        {questions.length === 0 && (
          <p className="text-xs text-ink-faint">
            No question results recorded for this scorecard.
            {card.error
              ? " The eval run errored before producing a structured scorecard — see the message below."
              : ""}
          </p>
        )}
        {card.error && card.message ? (
          <pre className="overflow-x-auto rounded-md bg-bad-wash p-3 text-xs font-mono text-bad whitespace-pre-wrap">
            {String(card.message)}
          </pre>
        ) : null}
        {!card.error && !commitMessage && llmSummary ? (
          // Fallback when we couldn't resolve the commit message — show the
          // LLM-generated summary so the card isn't completely contextless.
          <Markdown>{`**Eval-agent summary:** ${llmSummary}`}</Markdown>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}

function ScorecardMeta({ card }: { card: Scorecard }) {
  const fields: Array<[string, string | number | undefined]> = [
    ["Change", card.changeId ? String(card.changeId) : undefined],
    ["Timestamp", card.timestamp],
    ["Mode", card.mode ? String(card.mode) : undefined],
    [
      // The scorecard key is still `graphitiWrites` (legacy name, kept so stored
      // cards parse); since the makeover it counts lessons the evaluator wrote.
      "Lessons written",
      typeof card.graphitiWrites === "number" ? card.graphitiWrites : undefined,
    ],
    [
      "Project group",
      card.projectGroup ? String(card.projectGroup) : undefined,
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft sm:grid-cols-3">
      {fields
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="font-semibold text-ink-faint uppercase tracking-caps">
              {k}
            </dt>
            <dd className="font-mono break-all">{String(v)}</dd>
          </div>
        ))}
    </dl>
  );
}

function ScorecardQuestions({ questions }: { questions: ScorecardQuestion[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Answer</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Finding / Evidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {questions.map((q) => (
          <TableRow key={q.id ?? `${q.question}-${q.answer}`}>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-semibold text-xs text-ink">
                  {q.id ?? "—"}
                </span>
                {q.question && (
                  <span className="text-xs text-ink-soft">{q.question}</span>
                )}
              </div>
            </TableCell>
            <TableCell>{q.answer ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={severityToBadge(q.severity)}>
                {q.severity ?? "—"}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {q.finding && (
                  <span className="text-sm text-ink">{q.finding}</span>
                )}
                {q.evidence && (
                  <span className="text-xs text-ink-faint italic">
                    Evidence: {q.evidence}
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function severityToBadge(severity: string | undefined): BadgeVariant {
  const s = (severity ?? "").toLowerCase();
  if (s === "high" || s === "critical" || s === "blocker") return "blocked";
  if (s === "medium" || s === "warn" || s === "warning") return "writable";
  if (s === "low" || s === "info" || s === "ok") return "passing";
  return "neutral";
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "Z");
}
