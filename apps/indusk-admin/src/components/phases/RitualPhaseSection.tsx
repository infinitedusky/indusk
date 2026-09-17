import type { RitualWord } from "@infinitedusky/indusk-mcp/lifecycle";
import { phaseTitle, RITUAL_COPY } from "@/components/bars/labels";
import { StageList } from "@/components/PhasesSection";
import { TrajectoryRowsTable } from "@/components/phases/TrajectoryRowsTable";
import { Badge } from "@/components/ui/Badge";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ritualPhaseMarkdown } from "@/lib/markdown-export";
import { type Phase, phaseItems } from "@/lib/phases";

/**
 * The section a ritual phase renders as — Falsification or Cleanup — under
 * the phase-authoring flow (admin-ui-phase-progress cleanup, A35). The two
 * were separate components that differed by two headings and a test id:
 * the rows table (hypotheses / new units under test), the checklist
 * (fix items / decomposition), the complete badge, the stage strip, and
 * one copy button whose markdown has the same shape as the page.
 *
 * Closed by default like every section. Complete when every row is terminal
 * and every item checked.
 */

/** The test ids each ritual's tests read; the falsification ones predate the component. */
const TEST_IDS = {
  falsification: {
    rows: "falsification-hypotheses",
    items: "falsification-fix-items",
  },
  cleanup: { rows: "cleanup-rows", items: "cleanup-items" },
} satisfies Record<RitualWord, { rows: string; items: string }>;

export function RitualPhaseSection({
  ritual,
  planName,
  phase,
}: {
  ritual: RitualWord;
  planName: string;
  phase: Phase;
}) {
  const copy = RITUAL_COPY[ritual];
  const ids = TEST_IDS[ritual];
  const items = phaseItems(phase);
  const complete =
    items.every((i) => i.checked) &&
    phase.trajectoryRows.every(
      (r) => r.state === "passing" || r.state === "skipped",
    );
  return (
    <section className="flex flex-col gap-2" data-testid={`${ritual}-section`}>
      <CollapsibleSection
        title={
          <>
            {copy.title}
            <span className="ml-2 text-xs font-normal text-gray-500">
              ({phaseTitle(phase)}
              {phase.title ? `: ${phase.title}` : ""})
            </span>
          </>
        }
        defaultOpen={false}
        persistKey={`plan:${planName}:section:${ritual}`}
        headerRight={
          <>
            <StageList stages={phase.stages} />
            <Badge variant={complete ? "passing" : "writable"}>
              {complete ? "complete" : "in-progress"}
            </Badge>
          </>
        }
        copyMarkdown={ritualPhaseMarkdown(ritual, phase)}
      >
        <div className="flex flex-col gap-2">
          {phase.trajectoryRows.length > 0 && (
            <div data-testid={ids.rows}>
              <h3 className="mt-1 text-sm font-semibold text-gray-800">
                {copy.rowsHeading}
              </h3>
              <TrajectoryRowsTable rows={phase.trajectoryRows} />
            </div>
          )}
          {items.length > 0 && (
            <div data-testid={ids.items} className="mt-2">
              <h3 className="text-sm font-semibold text-gray-800">
                {copy.itemsHeading}
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li
                    key={`${item.checked ? "x" : "o"}-${item.text}`}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <span className="font-mono text-xs text-gray-500">
                      [{item.checked ? "x" : " "}]
                    </span>
                    <span
                      className={
                        item.checked ? "text-gray-500 line-through" : ""
                      }
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </section>
  );
}
