import type {
  LookRow,
  LookStanding,
} from "@infinitedusky/indusk-mcp/promises/standing";
import { LOOK_STYLE } from "@/components/bars/labels";

/**
 * Looks on the Promises dashboard (ui-promises ADR decision 7): a broken look
 * is a row above the promises, naming what broke, beside the broken promises;
 * the rest are one line of counts and a link to the Looks page. The standing
 * and its word are `promises/standing`'s (`readLookStanding`).
 *
 * promise: a-look-reports-like-any-promise
 */
export function LooksOnDashboard({
  looks,
  href,
}: {
  looks: LookRow[];
  /** The Looks page. */
  href: string;
}) {
  if (looks.length === 0) return null;
  const broken = looks.filter((l) => l.standing === "broken");
  const counts = new Map<LookStanding, { word: string; count: number }>();
  for (const l of looks) {
    if (l.standing === "broken") continue;
    const c = counts.get(l.standing) ?? { word: l.word, count: 0 };
    counts.set(l.standing, { ...c, count: c.count + 1 });
  }
  return (
    <section className="flex flex-col gap-2" data-testid="looks-dashboard">
      {broken.map((l) => (
        <div
          key={`${l.app}/${l.look}@${l.device ?? ""}`}
          data-testid="look-row"
          data-look={`${l.app}/${l.look}`}
          data-device={l.device ?? ""}
          data-standing={l.standing}
          className={`flex flex-col gap-hair rounded-md border px-3 py-2 text-sm ${LOOK_STYLE[l.standing]}`}
        >
          <span>
            <span className="font-medium">
              {l.app}/{l.look}
            </span>
            {l.device ? ` @ ${l.device}` : ""} · {l.word}
          </span>
          {l.symptom ? <span className="text-xs">{l.symptom}</span> : null}
        </div>
      ))}
      <p className="text-sm text-ink-soft" data-testid="looks-summary">
        <a href={href} className="font-medium text-dusk hover:underline">
          Looks
        </a>
        {[...counts.values()].map((c) => (
          <span key={c.word}>
            {" "}
            · {c.count} {c.word}
          </span>
        ))}
      </p>
    </section>
  );
}
