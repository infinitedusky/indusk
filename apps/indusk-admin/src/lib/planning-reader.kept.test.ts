// clause: admin-pages-load-fast/never-freezes
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readActivePlans } from "./planning-reader";

/**
 * admin-pages-load-fast, fourth round: a plan folder is read once per change to its files. A plan
 * read twice with nothing changed is the same reading; a document edited in place (same name, new
 * text) reads as the new text on the next read.
 */

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function project(title: string): { root: string; brief: string } {
  const root = mkdtempSync(join(tmpdir(), "kept-plan-"));
  dirs.push(root);
  const dir = join(root, ".indusk", "planning", "p");
  mkdirSync(dir, { recursive: true });
  const brief = join(dir, "brief.md");
  writeFileSync(brief, `---\ntitle: ${title}\nstatus: draft\n---\n\nbody\n`);
  return { root, brief };
}

describe("a plan folder is read once per change to its files", () => {
  it("A29 reads a plan twice with no change as the same reading", async () => {
    const { root } = project("First");
    const [a] = await readActivePlans(root);
    const [b] = await readActivePlans(root);
    expect(b.brief).toBe(a.brief);
  });

  it("A30 reads a brief edited in place as its new text", async () => {
    const { root, brief } = project("First");
    const [before] = await readActivePlans(root);
    expect(before.title).toBe("First");
    writeFileSync(brief, "---\ntitle: Second one\nstatus: draft\n---\n\nbody longer\n");
    const [after] = await readActivePlans(root);
    expect(after.title).toBe("Second one");
  });
});
