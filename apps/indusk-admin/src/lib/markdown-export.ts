import type {
  HypothesisEntry,
  TerminatorEntry,
} from "@infinitedusky/indusk-mcp/falsification/log";
import type { TrajectoryRow } from "@infinitedusky/indusk-mcp/trajectory/parser";
import {
  type ChecklistItem,
  extractChecklistItems,
  extractPhases,
  type Phase,
  splitPhasesAroundFalsification,
} from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/**
 * Plain-markdown serialization of PlanDetail's rendered sections — used by
 * the copy-to-clipboard affordances. Mirrors `PlanDetail.tsx`'s rendering
 * decisions (falsification phase priority, phase splitting) but is kept
 * separate from the component tree since its job is text assembly, not JSX.
 *
 * Every function returns markdown starting with a `##` heading so pasting a
 * single section elsewhere (e.g. Notion) keeps the section's own title.
 */

export function sectionMarkdown(heading: string, body: string): string {
  const trimmed = body.trim();
  return trimmed ? `## ${heading}\n\n${trimmed}` : `## ${heading}`;
}

export function trajectoryTableMarkdown(rows: TrajectoryRow[]): string {
  if (rows.length === 0) return "";
  const header = "| ID | Asserts | Writable at | Passes at | State |";
  const divider = "| --- | --- | --- | --- | --- |";
  const body = rows.map(
    (row) =>
      `| ${row.id} | ${row.asserts} | Phase ${row.writableAt} | Phase ${row.passesAt} | ${row.state} |`,
  );
  return [header, divider, ...body].join("\n");
}

export function checklistMarkdown(items: ChecklistItem[]): string {
  return items
    .map((item) => `- [${item.checked ? "x" : " "}] ${item.text}`)
    .join("\n");
}

export function phaseMarkdown(phase: Phase): string {
  const heading = `Phase ${phase.number}${phase.title ? `: ${phase.title}` : ""}`;
  const table = trajectoryTableMarkdown(phase.trajectoryRows);
  const body = [table, phase.content].filter(Boolean).join("\n\n");
  return sectionMarkdown(heading, body);
}

function hypothesisMarkdown(entry: HypothesisEntry): string {
  const lines = [`**Hypothesis (${entry.outcome})**`, entry.hypothesis];
  if (entry.testPath) lines.push(`\`${entry.testPath}\``);
  if (entry.note) lines.push(entry.note);
  return lines.join("\n\n");
}

/** Falsification rendering for the legacy `falsification.md`-log path. */
export function falsificationLogMarkdown(
  falsification: Plan["falsification"],
): string {
  if (!falsification) {
    return sectionMarkdown(
      "Falsification",
      "No falsification ritual run for this plan.",
    );
  }
  const hypotheses = falsification.entries.filter(
    (e): e is HypothesisEntry => e.kind === "hypothesis",
  );
  const terminator = falsification.entries.find(
    (e): e is TerminatorEntry => e.kind === "terminator",
  );
  const parts = hypotheses.map(hypothesisMarkdown);
  if (terminator) parts.push(`**Terminated:** ${terminator.reason}`);
  return sectionMarkdown(
    "Falsification",
    parts.length > 0 ? parts.join("\n\n") : "No hypotheses logged yet.",
  );
}

/** Falsification rendering for the phase-authoring flow (1.27.4+). */
export function falsificationPhaseMarkdown(phase: Phase): string {
  const heading = `Falsification${phase.title ? ` (Phase ${phase.number}: ${phase.title})` : ""}`;
  const checklistItems = extractChecklistItems(phase.content);
  const table = trajectoryTableMarkdown(phase.trajectoryRows);
  const checklist = checklistMarkdown(checklistItems);
  const parts = [
    table && `### Hypotheses\n\n${table}`,
    checklist && `### Fix items\n\n${checklist}`,
  ].filter(Boolean);
  return sectionMarkdown(heading, parts.join("\n\n"));
}

/**
 * Full-plan markdown for the "copy whole plan" affordance — every present
 * section concatenated in the same order `PlanDetail` renders them, each
 * separated by a horizontal rule so pasting into Notion keeps sections
 * visually distinct.
 */
export function planMarkdown(plan: Plan): string {
  const sections: string[] = [`# ${plan.name}\n\nStatus: ${plan.status}`];

  if (plan.research)
    sections.push(sectionMarkdown("Research", plan.research.content));
  if (plan.brief) sections.push(sectionMarkdown("Brief", plan.brief.content));
  if (plan.testPlan)
    sections.push(sectionMarkdown("Test Plan", plan.testPlan.content));
  if (plan.adr)
    sections.push(sectionMarkdown("ADR — Goal + Decision", plan.adr.content));

  if (plan.impl) {
    const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
    const split = splitPhasesAroundFalsification(phases);
    for (const phase of split.pre) sections.push(phaseMarkdown(phase));
    sections.push(
      split.falsification
        ? falsificationPhaseMarkdown(split.falsification)
        : falsificationLogMarkdown(plan.falsification),
    );
    for (const phase of split.post) sections.push(phaseMarkdown(phase));
  } else {
    sections.push(falsificationLogMarkdown(plan.falsification));
  }

  return sections.join("\n\n---\n\n");
}
