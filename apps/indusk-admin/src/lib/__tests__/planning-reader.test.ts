import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  readActivePlans,
  readArchivedPlans,
  readEvalScorecards,
  readMasterPlanOrder,
} from "../planning-reader";

const FIXTURE_ROOT = join(__dirname, "../../../test-fixtures/sample-project");

describe("planning-reader: readActivePlans", () => {
  it("returns one Plan per folder under .indusk/planning, skipping archive", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const names = plans.map((p) => p.name);
    expect(names).toContain("alpha-feature");
    expect(names).toContain("beta-bugfix");
    expect(names).toContain("gamma-missing-adr");
    expect(names).toContain("delta-malformed");
    // Archived plan must NOT appear here
    expect(names).not.toContain("zeta-archived");
    // None of the active plans should be marked archived
    for (const p of plans) expect(p.archived).toBe(false);
  });

  it("populates documents that exist and leaves missing ones undefined (T14 prep)", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const gamma = plans.find((p) => p.name === "gamma-missing-adr");
    expect(gamma).toBeDefined();
    expect(gamma?.brief).toBeDefined();
    expect(gamma?.impl).toBeDefined();
    // ADR file is intentionally absent — must be undefined, not throw
    expect(gamma?.adr).toBeUndefined();
    expect(gamma?.malformed).toBeUndefined();
  });

  it("flags malformed YAML frontmatter without throwing (T13 prep)", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const delta = plans.find((p) => p.name === "delta-malformed");
    expect(delta).toBeDefined();
    expect(delta?.malformed).toBe(true);
    // The malformed brief is not surfaced as parsed data
    expect(delta?.brief).toBeUndefined();
  });

  it("populates trajectory data when impl has a Test Trajectory section", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const alpha = plans.find((p) => p.name === "alpha-feature");
    expect(alpha?.impl?.trajectory).toBeDefined();
    expect(alpha?.impl?.trajectory?.rows).toHaveLength(2);
    expect(alpha?.impl?.trajectory?.rows[0].id).toBe("T1");
    expect(alpha?.impl?.trajectory?.rows[0].state).toBe("passing");
  });

  it("populates falsification data when log file exists", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const alpha = plans.find((p) => p.name === "alpha-feature");
    expect(alpha?.falsification).toBeDefined();
    expect(alpha?.falsification?.entries.length).toBeGreaterThanOrEqual(1);
    expect(alpha?.falsification?.complete).toBe(true);
  });

  it("derives status from impl.md frontmatter when present", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const alpha = plans.find((p) => p.name === "alpha-feature");
    // Both brief and impl set status; impl wins
    expect(alpha?.status).toBe("in-progress");
  });

  it("falls back to brief.md status when impl.md is absent", async () => {
    const plans = await readActivePlans(FIXTURE_ROOT);
    const beta = plans.find((p) => p.name === "beta-bugfix");
    expect(beta?.impl).toBeUndefined();
    expect(beta?.status).toBe("draft");
  });

  it("returns [] when planning directory does not exist", async () => {
    const empty = mkdtempSync(join(tmpdir(), "empty-project-"));
    try {
      const plans = await readActivePlans(empty);
      expect(plans).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("returns [] when planning directory is empty", async () => {
    const empty = mkdtempSync(join(tmpdir(), "empty-planning-"));
    try {
      mkdirSync(join(empty, ".indusk/planning"), { recursive: true });
      const plans = await readActivePlans(empty);
      expect(plans).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("planning-reader: readArchivedPlans", () => {
  it("returns plans under .indusk/planning/archive only", async () => {
    const plans = await readArchivedPlans(FIXTURE_ROOT);
    const names = plans.map((p) => p.name);
    expect(names).toEqual(["zeta-archived"]);
    expect(plans[0].archived).toBe(true);
  });

  it("populates retrospective when present", async () => {
    const plans = await readArchivedPlans(FIXTURE_ROOT);
    const zeta = plans.find((p) => p.name === "zeta-archived");
    expect(zeta?.retrospective).toBeDefined();
    expect(zeta?.retrospective?.frontmatter.status).toBe("final");
  });

  it("returns [] when archive directory does not exist", async () => {
    const empty = mkdtempSync(join(tmpdir(), "no-archive-"));
    try {
      mkdirSync(join(empty, ".indusk/planning"), { recursive: true });
      const plans = await readArchivedPlans(empty);
      expect(plans).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("planning-reader: readMasterPlanOrder", () => {
  it("returns plan names in the order they appear in master.md links (T3 prep)", () => {
    const order = readMasterPlanOrder(FIXTURE_ROOT);
    expect(order).toEqual([
      "alpha-feature",
      "beta-bugfix",
      "gamma-missing-adr",
      "delta-malformed",
    ]);
  });

  it("skips entries that aren't markdown links (no folder yet)", () => {
    const order = readMasterPlanOrder(FIXTURE_ROOT);
    expect(order).not.toContain("not-yet-created");
  });

  it("returns [] when master.md does not exist", () => {
    const empty = mkdtempSync(join(tmpdir(), "no-master-"));
    try {
      mkdirSync(join(empty, ".indusk/planning"), { recursive: true });
      const order = readMasterPlanOrder(empty);
      expect(order).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe("planning-reader: readEvalScorecards", () => {
  it("filters scorecards by date range, sorts most-recent-first", async () => {
    const cards = await readEvalScorecards(FIXTURE_ROOT, {
      from: new Date("2026-04-19T08:00:00Z"),
      to: new Date("2026-04-19T10:00:00Z"),
    });
    // 2 of 3 fixture entries fall in range; 11:00 is excluded
    expect(cards).toHaveLength(2);
    // Most recent first
    expect(cards[0].changeId).toBe("def456");
    expect(cards[1].changeId).toBe("abc123");
  });

  it("returns [] when no scorecards fall in the range", async () => {
    const cards = await readEvalScorecards(FIXTURE_ROOT, {
      from: new Date("2027-01-01T00:00:00Z"),
      to: new Date("2027-12-31T23:59:59Z"),
    });
    expect(cards).toEqual([]);
  });

  it("returns [] when results.log does not exist", async () => {
    const empty = mkdtempSync(join(tmpdir(), "no-eval-"));
    try {
      const cards = await readEvalScorecards(empty, {
        from: new Date(0),
        to: new Date(),
      });
      expect(cards).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("skips malformed jsonl lines without throwing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "malformed-eval-"));
    try {
      mkdirSync(join(dir, ".indusk/eval"), { recursive: true });
      writeFileSync(
        join(dir, ".indusk/eval/results.log"),
        '{"timestamp":"2026-04-19T10:00:00Z","changeId":"good"}\n' +
          "this is not json\n" +
          '{"timestamp":"2026-04-19T11:00:00Z","changeId":"alsogood"}\n',
      );
      const cards = await readEvalScorecards(dir, {
        from: new Date("2026-04-19T00:00:00Z"),
        to: new Date("2026-04-19T23:59:59Z"),
      });
      expect(cards).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Sanity check: fixtures still exist on disk where the tests expect them.
describe("planning-reader: fixture sanity", () => {
  it("FIXTURE_ROOT contains the expected sample-project structure", () => {
    expect(existsSync(join(FIXTURE_ROOT, ".indusk/planning"))).toBe(true);
    expect(existsSync(join(FIXTURE_ROOT, ".indusk/planning/master.md"))).toBe(true);
    expect(existsSync(join(FIXTURE_ROOT, ".indusk/planning/archive"))).toBe(true);
    expect(existsSync(join(FIXTURE_ROOT, ".indusk/eval/results.log"))).toBe(true);
  });
});
