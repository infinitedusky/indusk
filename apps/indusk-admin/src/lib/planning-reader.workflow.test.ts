import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readArchivedPlans } from "./planning-reader";

/**
 * admin-plan-type — A15, A18.
 *
 * A15 is the bug as it was met: reading release-ritual on 2026-10-01, three
 * dashed segments looked the same and one of them was a real gap. The plan is
 * read here from this repository's own archive, through the admin's reader, so
 * the row holds only when the declaration, the lifecycle's judgment and the
 * reader's pass-through are all in place.
 *
 * The plan folder is copied into a temporary project first: the row is about
 * one plan, and reading it alone keeps ninety other archived plans out of it.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const RELEASE_RITUAL = join(
  REPO_ROOT,
  ".indusk/planning/archive/release-ritual",
);

let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "reader-workflow-"));
  mkdirSync(join(project, ".indusk/planning/archive"), { recursive: true });
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("A15 — release-ritual reads as the bugfix it was", () => {
  it("the archived plan exists in this repository (sanity)", () => {
    expect(existsSync(join(RELEASE_RITUAL, "brief.md"))).toBe(true);
    expect(existsSync(join(RELEASE_RITUAL, "impl.md"))).toBe(true);
    // The whole point: it closed without one.
    expect(existsSync(join(RELEASE_RITUAL, "test-plan.md"))).toBe(false);
  });

  it("type bugfix; research and ADR skipped; test plan missing", async () => {
    cpSync(
      RELEASE_RITUAL,
      join(project, ".indusk/planning/archive/release-ritual"),
      {
        recursive: true,
      },
    );
    const plans = await readArchivedPlans(project);
    const plan = plans.find((p) => p.name === "release-ritual");
    expect(plan, "the reader did not return release-ritual").toBeDefined();

    const read = plan as unknown as {
      workflow?: string | null;
      position?: { segments: Record<string, string> };
    };
    expect(read.workflow).toBe("bugfix");
    expect(read.position?.segments.research).toBe("skipped");
    expect(read.position?.segments.adr).toBe("skipped");
    expect(read.position?.segments["test-plan"]).toBe("missing");
  });
});

describe("A18 — the workflow-type definitions are reachable by their subpath", () => {
  it("imports from outside the package and carries a definition per type", async () => {
    // Computed, so a subpath that is not exported yet fails this row by name
    // instead of failing the file to load.
    const specifier = ["@infinitedusky/indusk-mcp", "workflow-types"].join("/");
    let mod: { WORKFLOW_DEFINITIONS?: Record<string, unknown> } | null = null;
    try {
      mod = await import(/* @vite-ignore */ specifier);
    } catch {
      mod = null;
    }
    expect(
      mod,
      "@infinitedusky/indusk-mcp/workflow-types does not resolve — is it in package.json exports, and is the package built?",
    ).not.toBeNull();
    expect(Object.keys(mod?.WORKFLOW_DEFINITIONS ?? {}).sort()).toEqual([
      "bugfix",
      "feature",
      "refactor",
      "spike",
    ]);
  });
});
