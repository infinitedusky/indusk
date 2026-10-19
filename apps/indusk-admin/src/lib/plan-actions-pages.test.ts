// promise: approval-waits-for-a-finished-plan
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * approval-waits-for-the-planning-run A15: both pages that draw an Approve
 * ask the package's waiting answer for the plan and pass it to `planActions`,
 * so neither offers Approve on a rule of its own.
 */

const PAGES = [
  "src/app/p/[project]/plan/[name]/page.tsx",
  "src/app/p/[project]/plan/[name]/brief/page.tsx",
];

describe("A15 — the plan page and the brief page offer what the package says", () => {
  for (const page of PAGES) {
    it(`A15 ${page} reads the plan's waiting answer and passes it to planActions`, () => {
      const text = readFileSync(join(process.cwd(), page), "utf-8");
      expect(text, `${page} does not read the waiting answer`).toContain(
        "readWaiting(",
      );
      const call = text.match(/planActions\(\{[\s\S]*?\}\)/)?.[0] ?? "";
      expect(call, `${page}'s planActions call`).toContain(
        "waitingOn: waiting?.on",
      );
    });
  }
});
