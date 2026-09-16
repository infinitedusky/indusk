import { StageList } from "@/components/PhasesSection";
import { Badge } from "@/components/ui/Badge";
import { stateToBadge } from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import { phaseMarkdown } from "@/lib/markdown-export";
import { type Phase, phaseItems, phaseTitle } from "@/lib/phases";

/**
 * The cleanup ritual's phase, rendered as its own section beside
 * Falsification rather than as a "follow-up phase" (Sandy, U1 review,
 * 2026-09-16). Its checklist is the decomposition — extractions and reasoned
 * leave-as-is decisions — and its rows are the tests of any new unit. Closed
 * by default like every section; the header strip shows its stages.
 */
export function CleanupSection({
  planName,
  phase,
}: {
  planName: string;
  phase: Phase;
}) {
  const items = phaseItems(phase);
  const complete =
    items.every((i) => i.checked) &&
    phase.trajectoryRows.every(
      (r) => r.state === "passing" || r.state === "skipped",
    );
  return (
    <section className="flex flex-col gap-2" data-testid="cleanup-section">
      <CollapsibleSection
        title={
          <>
            Cleanup
            <span className="ml-2 text-xs font-normal text-gray-500">
              ({phaseTitle(phase)}
              {phase.title ? `: ${phase.title}` : ""})
            </span>
          </>
        }
        defaultOpen={false}
        persistKey={`plan:${planName}:section:cleanup`}
        headerRight={
          <>
            <StageList stages={phase.stages} />
            <Badge variant={complete ? "passing" : "writable"}>
              {complete ? "complete" : "in-progress"}
            </Badge>
          </>
        }
        copyMarkdown={phaseMarkdown(phase)}
      >
        <div className="flex flex-col gap-2">
          {phase.trajectoryRows.length > 0 && (
            <div data-testid="cleanup-rows">
              <h3 className="mt-1 text-sm font-semibold text-gray-800">
                New units under test
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Asserts</TableHead>
                    <TableHead>State</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phase.trajectoryRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-mono text-xs">{row.id}</span>
                      </TableCell>
                      <TableCell>{row.asserts}</TableCell>
                      <TableCell>
                        <Badge variant={stateToBadge(row.state)}>
                          {row.state}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {items.length > 0 && (
            <div data-testid="cleanup-items" className="mt-2">
              <h3 className="text-sm font-semibold text-gray-800">
                Decomposition
              </h3>
              <ul className="flex flex-col gap-1">
                {items.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-start gap-2 text-sm text-gray-800"
                  >
                    <span className="font-mono text-xs text-gray-500">
                      {item.checked ? "[x]" : "[ ]"}
                    </span>
                    <span>{item.text}</span>
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
