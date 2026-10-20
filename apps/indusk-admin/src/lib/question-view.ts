import type { Question } from "@infinitedusky/indusk-mcp/questions";

/**
 * What a plan's page shows of a question record: the row's time words, its order,
 * and which questions are still open. Pure; the record's cost and deadline are the
 * package's, read as stored.
 */

const COST_RANK = { expensive: 0, moderate: 1, cheap: 2 } as const;

/** Open: waiting for an answer, or gone ahead and not yet answered late. */
export const isOpen = (q: Question): boolean =>
  q.state === "waiting" || q.state === "went-ahead";

/** Every open question, expensive first, then oldest first. */
export function openQuestions(questions: readonly Question[]): Question[] {
  return questions
    .filter(isOpen)
    .sort(
      (a, b) => COST_RANK[a.cost] - COST_RANK[b.cost] || a.askedAt - b.askedAt,
    );
}

function ago(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** The words at the row's right edge: time left, that it is stopped, or when it went ahead. */
export function whenOf(q: Question, now: number): string {
  if (q.state === "went-ahead") return ago(now - (q.wentAheadAt ?? q.askedAt));
  if (q.dueAt === null || q.dueAt === undefined) {
    return q.cost === "expensive"
      ? "the build is stopped until you answer"
      : "waiting for you; no timer";
  }
  const left = Math.max(0, Math.ceil((q.dueAt - now) / 60_000));
  return left < 1 ? "goes ahead now" : `goes ahead in ${left} min`;
}

/** Where it was asked, in words. */
export const whereOf = (q: Question): string => q.id;
