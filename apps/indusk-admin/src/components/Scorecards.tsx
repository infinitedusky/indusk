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
 * from `.indusk/eval/results.log`, framed as a system-improvement signal,
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
   * Optional commit message per change-or-commit ID. Surfaces the human-
   * authored intent of the commit alongside the LLM-generated summary —
   * the real "what was being scored" signal. Resolved by `getCommitMessages`
   * in `src/lib/vcs.ts` (tries jj, falls back to git).
   */
  descriptions?: Map<string, string>;
}

export function ScorecardsList({ scorecards, descriptions }: ScorecardsListProps) {
  return (
    <section className="flex flex-col gap-4" data-testid="scorecards-list">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900">Eval Scorecards</h1>
        <p className="text-sm text-gray-600">
          Per-commit scores produced by the eval agent on every{" "}
          <code className="rounded bg-gray-100 px-1 text-xs font-mono">jj describe</code>.
          This is a self-improvement signal — what worked, what didn't, what the system
          could improve. Not tied to any single plan.
        </p>
        <p className="text-xs text-gray-500">
          Source: <span className="font-mono">.indusk/eval/results.log</span> ({scorecards.length}{" "}
          entries, most recent first)
        </p>
      </header>

      {scorecards.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="scorecards-empty">
          No scorecards yet — run a few <code className="font-mono">jj describe</code>{" "}
          commands inside Claude Code, and they'll start appearing.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {scorecards.map((card) => (
            <ScorecardCard
              key={`${card.timestamp}-${card.changeId ?? "unknown"}`}
              card={card}
              jjDescription={
                card.changeId ? descriptions?.get(String(card.changeId)) : undefined
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
  jjDescription,
}: {
  card: Scorecard;
  jjDescription?: string;
}) {
  const status = card.error ? "error" : "ok";
  const llmSummary =
    (card.summary as string | undefined) ?? (card.message as string | undefined);
  // Prefer the actual jj describe text when we have it — it's the human-
  // authored intent of the commit being scored. Fall back to the LLM-
  // generated summary, then to a placeholder.
  const headerLine =
    jjDescription?.split("\n")[0]?.trim() || llmSummary || "(no description)";
  const questions = Array.isArray(card.questions)
    ? (card.questions as ScorecardQuestion[])
    : [];
  const titleNode = (
    <span className="flex flex-1 items-center gap-2 truncate">
      <span className="text-xs text-gray-500 font-mono shrink-0">
        {formatTimestamp(card.timestamp)}
      </span>
      <span className="text-xs text-gray-500 font-mono shrink-0">
        {(card.changeId ?? "—").slice(0, 8)}
      </span>
      <span className="text-sm text-gray-800 truncate">{headerLine}</span>
    </span>
  );
  const headerRight = (
    <span className="flex items-center gap-2">
      {card.mode ? (
        <span className="text-xs text-gray-500">{String(card.mode)}</span>
      ) : null}
      <Badge variant={status === "error" ? "blocked" : "passing"}>
        {status === "error" ? "✗ error" : "✓ ok"}
      </Badge>
    </span>
  );
  return (
    <CollapsibleSection title={titleNode} headerRight={headerRight} defaultOpen={false}>
      <div className="flex flex-col gap-3">
        {jjDescription && (
          <section
            className="rounded border border-blue-200 bg-blue-50 p-3"
            data-testid="scorecard-commit-message"
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Commit message
            </h3>
            <pre className="mt-1 text-sm text-gray-800 whitespace-pre-wrap font-sans">
              {jjDescription}
            </pre>
          </section>
        )}
        <ScorecardMeta card={card} />
        {questions.length > 0 && <ScorecardQuestions questions={questions} />}
        {questions.length === 0 && (
          <p className="text-xs text-gray-500">
            No question results recorded for this scorecard.
            {card.error
              ? " The eval run errored before producing a structured scorecard — see the message below."
              : ""}
          </p>
        )}
        {card.error && card.message ? (
          <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs font-mono text-red-800 whitespace-pre-wrap">
            {String(card.message)}
          </pre>
        ) : null}
        {!card.error && !jjDescription && llmSummary ? (
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
      "Graphiti writes",
      typeof card.graphitiWrites === "number" ? card.graphitiWrites : undefined,
    ],
    ["Project group", card.projectGroup ? String(card.projectGroup) : undefined],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 sm:grid-cols-3">
      {fields
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="font-semibold text-gray-500 uppercase tracking-wide">{k}</dt>
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
                <span className="font-semibold text-xs text-gray-900">
                  {q.id ?? "—"}
                </span>
                {q.question && (
                  <span className="text-xs text-gray-600">{q.question}</span>
                )}
              </div>
            </TableCell>
            <TableCell>{q.answer ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={severityToBadge(q.severity)}>{q.severity ?? "—"}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {q.finding && (
                  <span className="text-sm text-gray-800">{q.finding}</span>
                )}
                {q.evidence && (
                  <span className="text-xs text-gray-500 italic">
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
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
