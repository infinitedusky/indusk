// look: question-row.cheap
// look: question-row.expensive
// look: question-row.went-ahead
// look: plan.needs-you
// look: nav.expanded
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * decisions-as-questions T22 (system tier): the three question rows read approved, the
 * component that draws them is catalogued with a story per state, and the looks lint
 * finds nothing wrong with it. The by-value check in Chromium at each device is
 * `indusk looks check admin` at landing (it opens the served Storybook and the running
 * admin); this file is what holds the pieces it relies on.
 */
const REPO = resolve(__dirname, "../../../..");
const CLI = resolve(REPO, "apps/indusk-mcp/dist/bin/cli.js");
const read = (rel: string) =>
  JSON.parse(readFileSync(resolve(REPO, rel), "utf-8"));

describe("T22 — the question rows are approved, catalogued and clean", () => {
  it("the three mockups are recorded approved by a person", () => {
    const entries = (
      read(".indusk/mockups/admin/approved.json") as {
        approvals: Array<{ mockup: string; by: string }>;
      }
    ).approvals;
    for (const name of [
      "question-row.cheap",
      "question-row.expensive",
      "question-row.went-ahead",
    ]) {
      const e = entries.find((x) => x.mockup === name);
      expect(e, `${name} is not recorded approved`).toBeDefined();
      expect(e?.by).toBeTruthy();
    }
  });

  it("the catalog lists question-row with a state per mockup, in the one file that marks it", () => {
    const catalog = read(".indusk/mockups/admin/components.json") as {
      components?: Array<{ name: string; file: string; states?: string[] }>;
    };
    const entry = catalog.components?.find((c) => c.name === "question-row");
    expect(entry?.file).toBe(
      "apps/indusk-admin/src/components/ui/QuestionRow.tsx",
    );
    const stories = readFileSync(
      resolve(
        REPO,
        "apps/indusk-admin/src/components/ui/QuestionRow.stories.tsx",
      ),
      "utf-8",
    );
    for (const story of ["Cheap", "Expensive", "WentAhead"]) {
      expect(stories).toContain(`export const ${story}`);
    }
  });

  it("the looks lint has nothing to say about it", () => {
    const out = spawnSync("node", [CLI, "looks", "lint", "admin"], {
      cwd: REPO,
      encoding: "utf-8",
    });
    const mine = `${out.stdout}${out.stderr}`
      .split("\n")
      .filter((line) => /question-row|QuestionRow/.test(line));
    expect(mine).toEqual([]);
  });
});
