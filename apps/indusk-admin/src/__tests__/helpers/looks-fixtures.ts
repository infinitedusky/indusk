import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The throwaway project the admin's look contracts are held against
 * (cockpit-redraw A10, plan-stories A6): `screens.json` declares its pages
 * under `/p/dusk/...`, one page cannot be a plan in four conditions, so the
 * project holds a fixture plan for each — `looks-fixture-parts` (brief being
 * written, so also `brief.writing`), `-working` (approved, so also
 * `brief.approved`), `-no-brief` (research only, so `brief.empty`),
 * `-needs-you` (its impl waits on approval) and `-released` (archived).
 */

export const doc = (status: string, extra = "") =>
  `---\ntitle: "fixture"\nstatus: ${status}\nworkflow: feature\n${extra}---\n\n# fixture\n`;

export const brief = (status: string) =>
  doc(status, 'description: "A plan the look check opens in one condition."\n');

export const impl = (status: string, extra = "") =>
  `${doc(status, extra)}\n## Checklist\n\n### Build Phase 1: One\n\n- [ ] an item\n`;

/** One fixture plan: its documents, each by its status; `archived` puts it under `archive/`. */
export function writePlan(
  project: string,
  name: string,
  docs: { brief: string; impl?: string; approved?: boolean },
  archived = false,
) {
  const dir = join(
    project,
    ".indusk",
    "planning",
    ...(archived ? ["archive"] : []),
    name,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), brief(docs.brief));
  if (docs.brief !== "accepted") return;
  for (const d of ["research", "test-plan", "adr"])
    writeFileSync(join(dir, `${d}.md`), doc("accepted"));
  if (docs.impl)
    writeFileSync(
      join(dir, "impl.md"),
      impl(docs.impl, docs.approved ? 'approved_brief: "abc"\n' : ""),
    );
}

/** The project's `.indusk/config.json`, merged over `{ mode: "full" }`. */
export function writeConfig(
  project: string,
  extra: Record<string, unknown> = {},
) {
  mkdirSync(join(project, ".indusk"), { recursive: true });
  writeFileSync(
    join(project, ".indusk", "config.json"),
    JSON.stringify({ mode: "full", ...extra }),
  );
}

/** The five fixture plans every look contract's screens are declared against. */
export function writeLooksPlans(project: string) {
  writePlan(project, "looks-fixture-parts", { brief: "draft" });
  writePlan(project, "looks-fixture-working", {
    brief: "accepted",
    impl: "in-progress",
    approved: true,
  });
  // research only, no brief: `brief.empty`
  mkdirSync(join(project, ".indusk", "planning", "looks-fixture-no-brief"), {
    recursive: true,
  });
  writeFileSync(
    join(
      project,
      ".indusk",
      "planning",
      "looks-fixture-no-brief",
      "research.md",
    ),
    doc("accepted"),
  );
  writePlan(project, "looks-fixture-needs-you", {
    brief: "accepted",
    impl: "draft",
  });
  writePlan(
    project,
    "looks-fixture-released",
    { brief: "accepted", impl: "completed", approved: true },
    true,
  );
}
