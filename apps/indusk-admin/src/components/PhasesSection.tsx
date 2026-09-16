import { phaseLabel } from "@infinitedusky/indusk-mcp/impl-headings";
import { Markdown } from "@/components/Markdown";
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
import { type Phase, phaseTitle, type Stage } from "@/lib/phases";

/**
 * The implementation plan: an impl's phases, each a collapsible keyed by kind and number, with its
 * stages (implementation items, then each gate) shown in the header as a
 * strip of states — done / active / pending / opted-out — so the shape of a
 * phase is readable without opening it. The body holds the trajectory rows
 * that pass at this phase and the phase's own markdown.
 */

interface PhasesSectionProps {
  phases: Phase[];
  heading: string;
  testId: string;
  planName: string;
  /** `kind-number` of the active phase, marked `data-active="true"`. */
  activeKey?: string | null;
}

const STAGE_LABEL: Record<Stage["kind"], string> = {
  implementation: "items",
  Verification: "Verification",
  OTel: "OTel",
  Context: "Context",
  Document: "Document",
};

const STATE_CLASS: Record<Stage["state"], string> = {
  done: "border-green-200 bg-green-50 text-green-800",
  active: "border-blue-200 bg-blue-50 text-blue-800",
  pending: "border-gray-200 bg-white text-gray-500",
  skipped: "border-gray-200 bg-gray-50 text-gray-400 line-through",
  "opted-out": "border-amber-200 bg-amber-50 text-amber-800",
};

export function StageList({ stages }: { stages: Stage[] }) {
  if (stages.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-1" data-testid="stage-list">
      {stages.map((stage) => (
        <li
          key={stage.kind}
          data-stage={stage.kind}
          data-state={stage.state}
          title={stage.proof ?? `${stage.checked} of ${stage.total}`}
          className={`rounded border px-1.5 py-0.5 text-[10px] leading-4 ${STATE_CLASS[stage.state]}`}
        >
          <span className="font-medium">{STAGE_LABEL[stage.kind]}</span>{" "}
          <span>
            {stage.checked} of {stage.total}
          </span>
          {stage.proof ? (
            <span className="ml-1 inline-block max-w-[12rem] truncate align-bottom text-amber-700">
              {stage.proof}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PhasesSection({
  phases,
  heading,
  testId,
  planName,
  activeKey = null,
}: PhasesSectionProps) {
  if (phases.length === 0) return null;

  return (
    <section className="flex flex-col gap-2" data-testid={testId}>
      <CollapsibleSection
        title={heading}
        defaultOpen={false}
        persistKey={`plan:${planName}:section:${testId}`}
        copyMarkdown={phases.map(phaseMarkdown).join("\n\n---\n\n")}
      >
        <div className="flex flex-col gap-2">
          {phases.map((phase) => {
            const key = `${phase.kind}-${phase.number}`;
            return (
              <div
                key={key}
                data-testid="phase"
                data-phase={key}
                data-active={key === activeKey ? "true" : undefined}
              >
                <CollapsibleSection
                  title={`${phaseTitle(phase)}${phase.title ? `: ${phase.title}` : ""}`}
                  defaultOpen={false}
                  persistKey={`plan:${planName}:phase:${key}`}
                  copyMarkdown={phaseMarkdown(phase)}
                  headerRight={<StageList stages={phase.stages} />}
                >
                  <div className="flex flex-col gap-3">
                    {phase.trajectoryRows.length > 0 && (
                      <div data-testid={`phase-${key}-trajectory`}>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ID</TableHead>
                              <TableHead>Asserts</TableHead>
                              <TableHead>Writable at</TableHead>
                              <TableHead>Passes at</TableHead>
                              <TableHead>State</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {phase.trajectoryRows.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell>
                                  <span className="font-mono text-xs">
                                    {row.id}
                                  </span>
                                </TableCell>
                                <TableCell>{row.asserts}</TableCell>
                                <TableCell>
                                  {phaseLabel({
                                    kind: row.writableAtKind,
                                    number: row.writableAt,
                                  })}
                                </TableCell>
                                <TableCell>
                                  {phaseLabel({
                                    kind: row.passesAtKind,
                                    number: row.passesAt,
                                  })}
                                </TableCell>
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
                    <Markdown>{phase.content}</Markdown>
                  </div>
                </CollapsibleSection>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </section>
  );
}
