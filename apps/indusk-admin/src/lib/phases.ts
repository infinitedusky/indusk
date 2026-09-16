import {
  fencedLineMask,
  type PhaseKind,
  parsePhaseHeading,
} from "@infinitedusky/indusk-mcp/impl-headings";
import {
  findPhase,
  parseImplString,
} from "@infinitedusky/indusk-mcp/impl-parser";
import {
  derivePhaseActivity,
  type PhaseActivity,
  RITUAL_ORDER,
  type StageKind,
  type StageState,
} from "@infinitedusky/indusk-mcp/lifecycle";
import type {
  Trajectory,
  TrajectoryRow,
} from "@infinitedusky/indusk-mcp/trajectory/parser";

/**
 * The admin's view of an impl's phases — an adapter over the package parser.
 *
 * Until admin-ui-phase-progress this file carried its own `### Phase N` regex.
 * It could not see `### Test Phase N` or `### Build Phase N`, so every impl
 * authored since test-phase-structure (2026-08-12) rendered as one long
 * Phase 1; gate headings were raw markdown; rows attached by bare number, so
 * a Test Phase 1 row landed on Build Phase 1. The package's `parseImplString`
 * is the one parser (pinned by `lifecycle-single-definition.test.ts`, which
 * refuses a heading regex here); this module only reshapes its output for
 * rendering and slices each phase's raw markdown for the `<Markdown>` body.
 */

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/** One stage of a phase: its implementation items, then each gate it carries. */
export interface Stage {
  kind: StageKind;
  /** `done | active | pending | skipped | opted-out` — the lifecycle's segment vocabulary. */
  state: StageState["state"];
  checked: number;
  total: number;
  /** The conversation proof of an opted-out gate. */
  proof?: string;
  items: ChecklistItem[];
}

export interface Phase {
  kind: PhaseKind;
  number: number;
  /** Document position — what orders two sequences. */
  ordinal: number;
  title: string;
  stages: Stage[];
  /** What is happening in this phase now — the lifecycle's verb (`closed` when every stage is done). */
  activity: PhaseActivity;
  /** Every checklist item across the phase's stages. */
  itemCount: number;
  /** Raw markdown content (everything between this phase's heading and the next). */
  content: string;
  /** Trajectory rows whose `Passes at` is this phase, by kind and number. */
  trajectoryRows: TrajectoryRow[];
}

/** `Test Phase 1` / `Phase 2` — the spelling the impl itself uses for the phase. */
export function phaseTitle(phase: Pick<Phase, "kind" | "number">): string {
  return `${phase.kind === "test" ? "Test Phase" : "Phase"} ${phase.number}`;
}

const GATE_TYPE_TO_STAGE: Record<string, StageKind> = {
  implementation: "implementation",
  verification: "Verification",
  otel: "OTel",
  context: "Context",
  document: "Document",
};

/**
 * Extract phases from an impl.md body, in document order. Returns `[]` when
 * the body has no phase headings.
 *
 * Content ends at the next phase heading of either kind, or at a level-2
 * heading (so `## Files Affected`, `## Dependencies`, `## Notes` do not bleed
 * into a phase); phases appended after those sections are still found. Fenced
 * lines are masked, so a deferral body carrying a heading-shaped line does
 * not split a phase.
 */
export function extractPhases(
  implContent: string,
  trajectory?: Trajectory,
): Phase[] {
  const parsed = parseImplString(implContent);
  const lines = implContent.split("\n");
  const fenced = fencedLineMask(lines);

  const blocks: Array<{
    kind: PhaseKind;
    number: number;
    title: string;
    lines: string[];
  }> = [];
  let current: (typeof blocks)[number] | null = null;
  for (const [index, line] of lines.entries()) {
    if (fenced[index]) {
      if (current) current.lines.push(line);
      continue;
    }
    const heading = parsePhaseHeading(line);
    if (heading) {
      current = {
        kind: heading.kind,
        number: heading.number,
        title: heading.name,
        lines: [],
      };
      blocks.push(current);
      continue;
    }
    // A level-2 heading closes the current phase's content but does not end
    // the scan: the close-out rituals append their phases AFTER `## Notes`,
    // and the package parser sees those — so must this (A3 parity).
    if (current && line.startsWith("## ")) {
      current = null;
      continue;
    }
    if (current) current.lines.push(line);
  }

  return blocks.map((block) => {
    const ref = { kind: block.kind, number: block.number };
    const implPhase = findPhase(parsed, ref);
    const itemsByStage = new Map<StageKind, ChecklistItem[]>();
    for (const gate of implPhase?.gates ?? []) {
      const stage = GATE_TYPE_TO_STAGE[gate.type];
      if (!stage) continue;
      itemsByStage.set(stage, [
        ...(itemsByStage.get(stage) ?? []),
        ...gate.items.map((i) => ({ text: i.text, checked: i.checked })),
      ]);
    }
    const derived = implPhase ? derivePhaseActivity(implPhase, null) : null;
    const states = derived?.stages ?? [];
    const stages: Stage[] = states.map((s) => ({
      kind: s.kind,
      state: s.state,
      checked: s.checked,
      total: s.total,
      ...(s.proof ? { proof: s.proof } : {}),
      items: itemsByStage.get(s.kind) ?? [],
    }));
    return {
      kind: block.kind,
      number: block.number,
      ordinal: implPhase?.ordinal ?? 0,
      title: block.title,
      stages,
      activity: derived?.activity ?? "closed",
      itemCount: stages.reduce((n, s) => n + s.items.length, 0),
      content: block.lines.join("\n").trim(),
      trajectoryRows: trajectory
        ? trajectory.rows.filter(
            (r) => r.passesAtKind === block.kind && r.passesAt === block.number,
          )
        : [],
    };
  });
}

/**
 * Split a phase list into three groups around the falsification phase:
 *   - `pre`:           phases BEFORE the falsification phase
 *   - `falsification`: the first phase whose title STARTS with the ritual word
 *                      (`RITUAL_ORDER[0]`, case-insensitive) — the same rule the
 *                      retrospective readiness gate applies; `null` when absent
 *   - `post`:          phases AFTER it (fix-in-scope follow-ups)
 */
export interface PhaseSplit {
  pre: Phase[];
  falsification: Phase | null;
  post: Phase[];
}

export function splitPhasesAroundFalsification(phases: Phase[]): PhaseSplit {
  const word = RITUAL_ORDER[0];
  const idx = phases.findIndex((p) => p.title.toLowerCase().startsWith(word));
  if (idx === -1) {
    return { pre: phases, falsification: null, post: [] };
  }
  return {
    pre: phases.slice(0, idx),
    falsification: phases[idx],
    post: phases.slice(idx + 1),
  };
}

/** Every checklist item of a phase, in stage order. */
export function phaseItems(phase: Phase): ChecklistItem[] {
  return phase.stages.flatMap((s) => s.items);
}
