import type { PlanParts } from "@infinitedusky/indusk-mcp/plans/parts";
import { phaseTitle } from "@/components/bars/labels";
import type { PhaseRowTone } from "@/components/ui/PhaseRow";
import {
  type ChecklistItem,
  extractPhases,
  type Phase,
  phaseItems,
  splitPhasesAroundFalsification,
} from "@/lib/phases";
import type { Plan } from "@/lib/planning-reader";

/**
 * What the plan page's folded parts say on their closed rows, and the rows an
 * opened Phases or Documents part lists. Only counting and wording over what
 * the package already read (`plans/parts`, the impl through `extractPhases`);
 * nothing here parses a document.
 */

const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function promisesSummary(parts: PlanParts): string {
  const enforced = parts.promises.filter((p) => p.state === "enforced").length;
  return `${parts.promises.length} · ${enforced} enforced`;
}

export function expectationsSummary(parts: PlanParts): string {
  return parts.expectations.length === 0
    ? "none"
    : String(parts.expectations.length);
}

export function looksSummary(parts: PlanParts): string {
  if (parts.looks.length === 0) return parts.noLooks ?? "none listed";
  const approved = parts.looks.filter((l) => l.approval === "approved").length;
  return `${approved} of ${parts.looks.length} approved`;
}

const keyOf = (p: Phase) => `${p.kind}-${p.number}`;

function progress(phase: Phase): { done: number; total: number } {
  const items = phaseItems(phase);
  return { done: items.filter((i) => i.checked).length, total: items.length };
}

/** Items done and in all, across `phases`. */
function tally(phases: Phase[]): { done: number; total: number } {
  return phases
    .map(progress)
    .reduce((t, p) => ({ done: t.done + p.done, total: t.total + p.total }), {
      done: 0,
      total: 0,
    });
}

function isDone(phase: Phase): boolean {
  const { done, total } = progress(phase);
  return total > 0 && done === total;
}

export interface PhaseView {
  key: string;
  name: string;
  count: string;
  state: string;
  tone: PhaseRowTone;
  /** The phase's opening paragraph, when the impl has one. */
  summary?: string;
  items: ChecklistItem[];
}

/** One phase as a row: its name, items done of total, and where it stands. */
export function phaseView(phase: Phase, activeKey: string | null): PhaseView {
  const { done, total } = progress(phase);
  const [state, tone]: [string, PhaseRowTone] = isDone(phase)
    ? ["done ✓", "done"]
    : done > 0 || keyOf(phase) === activeKey
      ? ["in progress", "doing"]
      : ["not started", "idle"];
  return {
    key: keyOf(phase),
    name: phaseTitle(phase),
    count: `${done} of ${total}`,
    state,
    tone,
    ...(phase.summary ? { summary: phase.summary } : {}),
    items: phaseItems(phase),
  };
}

/** The Phases part's closed row: the current phase and the items done. */
export function phasesSummary(
  phases: Phase[],
  activeKey: string | null,
): string {
  const { done, total } = tally(phases);
  const counted = `${done} of ${total} done`;
  const current =
    phases.find((p) => keyOf(p) === activeKey) ??
    phases.find((p) => !isDone(p));
  if (!current) return `All phases done · ${counted}`;
  const ofKind = phases.filter((p) => p.kind === current.kind).length;
  return `${phaseTitle(current)} of ${ofKind} · ${counted}`;
}

export interface PlanDocument {
  slug: string;
  label: string;
  status: string;
  tone: PhaseRowTone;
  content: string;
}

const DOING = /progress|draft|proposed/;

function statusTone(status: string): PhaseRowTone {
  return DOING.test(status) ? "doing" : "done";
}

/**
 * The documents a plan has, in the order the mockups list them: a master's
 * own `master.md` (the body the caller read, when it did), research, brief,
 * test plan, ADR, impl, then falsification and cleanup (the impl's phases of
 * those names) and the audit, each only when present.
 */
export function planDocuments(plan: Plan, master?: string): PlanDocument[] {
  const docs: PlanDocument[] = [];
  if (master !== undefined) {
    docs.push({
      slug: "master",
      label: "Master plan",
      status: "written",
      tone: "done",
      content: master,
    });
  }
  const add = (
    slug: string,
    label: string,
    doc: { frontmatter: { status?: string }; content: string } | undefined,
    status = doc?.frontmatter.status ?? "written",
  ) => {
    if (doc) {
      docs.push({
        slug,
        label,
        status,
        tone: statusTone(status),
        content: doc.content,
      });
    }
  };
  add("research", "Research", plan.research);
  add("brief", "Brief", plan.brief);
  add("test-plan", "Test plan", plan.testPlan);
  add("adr", "ADR", plan.adr);
  let ritual: ReturnType<typeof splitPhasesAroundFalsification> | null = null;
  if (plan.impl) {
    const phases = extractPhases(plan.impl.content, plan.impl.trajectory);
    ritual = splitPhasesAroundFalsification(phases);
    const { done, total } = tally(phases);
    const status = plan.impl.frontmatter.status ?? "written";
    add(
      "impl",
      "Impl",
      plan.impl,
      total > 0 && done < total ? `${status}, ${done} of ${total}` : status,
    );
  }
  for (const [slug, label, phase] of [
    ["falsification", "Falsification", ritual?.falsification],
    ["cleanup", "Cleanup", ritual?.cleanup],
  ] as const) {
    if (phase) {
      const status = isDone(phase) ? "done" : "in progress";
      docs.push({
        slug,
        label,
        status,
        tone: statusTone(status),
        content: phase.content,
      });
    }
  }
  add("audit", "Audit", plan.audit);
  return docs;
}

export const documentsSummary = (n: number) => count(n, "document");
