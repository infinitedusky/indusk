import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readArchivedPlans } from "./planning-reader";

/**
 * brief-as-the-contract A29 — a regression guard: the archive cache never
 * serves a stale plan. A file edited in place does not change its folder's
 * mtime, so the cache key must reach the files.
 */

let project: string;
beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "archive-cache-"));
  mkdirSync(join(project, ".indusk/planning/archive/old-plan"), {
    recursive: true,
  });
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

const brief = (title: string) =>
  `---\ntitle: "${title}"\nstatus: accepted\n---\n\n# ${title}\n`;

describe("A29 — an archived plan's file edited in place is read afresh", () => {
  it("the next request shows the new text", async () => {
    const file = join(project, ".indusk/planning/archive/old-plan/brief.md");
    writeFileSync(file, brief("First"));
    const first = await readArchivedPlans(project);
    expect(JSON.stringify(first)).toContain("First");
    writeFileSync(file, brief("Second"));
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    const second = await readArchivedPlans(project);
    expect(JSON.stringify(second)).toContain("Second");
    expect(JSON.stringify(second)).not.toContain("First");
  });
});
