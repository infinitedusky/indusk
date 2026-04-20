import type { Trajectory, TrajectoryRow } from "@infinitedusky/indusk-mcp/trajectory/parser";

/**
 * Parsed phase from an impl.md `## Checklist` section.
 *
 * The phase parser walks the markdown body, splits on `### Phase N: Title`
 * headings (level-3 H3), and groups every line up to the next `### Phase`
 * heading (or end of document) as that phase's content. It does NOT separate
 * verification / context / document gates — those are still raw markdown
 * inside `content`. The PhasesSection component renders the content as
 * markdown wrapped in a CollapsibleSection.
 *
 * Trajectory rows belonging to a phase are matched via the trajectory's
 * `Passes at` column (rows that pass at this phase number). This pairing
 * makes T8 satisfiable — every phase shows the rows that should flip in it.
 */
export interface Phase {
  number: number;
  title: string;
  /** Raw markdown content (everything between this phase's heading and the next). */
  content: string;
  /** Trajectory rows whose `Passes at` is this phase's number. */
  trajectoryRows: TrajectoryRow[];
}

const PHASE_HEADING_RE = /^###\s+Phase\s+(\d+)(?::\s*(.*))?$/m;

/**
 * Extract phases from an impl.md body. Returns phases in the order they appear
 * in the markdown. Returns `[]` if no `### Phase N` headings are present.
 *
 * Stops scanning at any level-2 heading after the first phase (so the trailing
 * `## Files Affected`, `## Dependencies`, `## Notes` sections don't bleed into
 * the last phase).
 */
export function extractPhases(implContent: string, trajectory?: Trajectory): Phase[] {
  const lines = implContent.split("\n");
  const phases: Phase[] = [];
  let current: { number: number; title: string; lines: string[] } | null = null;
  let stoppedAtL2 = false;

  for (const line of lines) {
    if (stoppedAtL2) break;

    const phaseMatch = line.match(PHASE_HEADING_RE);
    if (phaseMatch) {
      if (current) {
        phases.push(buildPhase(current, trajectory));
      }
      current = {
        number: Number.parseInt(phaseMatch[1], 10),
        title: (phaseMatch[2] ?? "").trim(),
        lines: [],
      };
      continue;
    }

    // Stop on any level-2 heading we encounter AFTER the first phase
    if (current && /^##\s+\S/.test(line) && !/^###/.test(line)) {
      stoppedAtL2 = true;
      break;
    }

    if (current) current.lines.push(line);
  }

  if (current) phases.push(buildPhase(current, trajectory));
  return phases;
}

function buildPhase(
  raw: { number: number; title: string; lines: string[] },
  trajectory: Trajectory | undefined,
): Phase {
  const trajectoryRows = trajectory
    ? trajectory.rows.filter((r) => r.passesAt === raw.number)
    : [];
  return {
    number: raw.number,
    title: raw.title,
    content: raw.lines.join("\n").trim(),
    trajectoryRows,
  };
}

/**
 * Split a phase list into three groups around the falsification phase:
 *   - `pre`:           phases BEFORE the falsification phase
 *   - `falsification`: the phase whose title contains "Falsification" (case-insensitive);
 *                      `null` when no such phase exists
 *   - `post`:          phases AFTER the falsification phase (fix-in-scope follow-ups
 *                      derived from the ritual)
 *
 * If multiple phases have "Falsification" in the title, the FIRST match wins —
 * later ones fall into `post`. In practice plans author exactly one falsification
 * phase; the first-match rule is a defensive choice for the edge case.
 *
 * Matching is a case-insensitive substring, not a regex — the /falsify skill's
 * recommended convention is `### Phase N: Falsification — {summary}` but the
 * title field is free-form, so we match the word loosely.
 */
export interface PhaseSplit {
  pre: Phase[];
  falsification: Phase | null;
  post: Phase[];
}

export function splitPhasesAroundFalsification(phases: Phase[]): PhaseSplit {
  const idx = phases.findIndex((p) =>
    p.title.toLowerCase().includes("falsification"),
  );
  if (idx === -1) {
    return { pre: phases, falsification: null, post: [] };
  }
  return {
    pre: phases.slice(0, idx),
    falsification: phases[idx],
    post: phases.slice(idx + 1),
  };
}

/**
 * Extract `- [ ]` / `- [x]` checklist items from markdown content. Used by
 * the falsification-phase rendering to surface fix items as a discrete list.
 *
 * Intentionally narrow — not a general markdown AST parser. Matches only the
 * standard GFM task-list shape at line start with mandatory space between
 * brackets. Uppercase `X` is rejected (contract is lowercase `x`) so we don't
 * silently accept non-standard syntax.
 */
export interface ChecklistItem {
  text: string;
  checked: boolean;
}

const CHECKLIST_ITEM_RE = /^- \[( |x)\] (.+)$/;

export function extractChecklistItems(markdown: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(CHECKLIST_ITEM_RE);
    if (match) {
      items.push({
        checked: match[1] === "x",
        text: match[2].trim(),
      });
    }
  }
  return items;
}
