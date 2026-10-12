import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { scanComponents } from "@infinitedusky/indusk-mcp/looks/components";
import { readApp } from "@infinitedusky/indusk-mcp/looks/mockups";
import { describe, expect, it } from "vitest";

/**
 * T16 — component-reuse audit.
 *
 * Walks `apps/indusk-admin/src/` for `.tsx` files. For each, looks for inline
 * JSX patterns where a corresponding primitive in `src/components/ui/` exists
 * — e.g., `<button className=` when there's a `<Button>` primitive, `<table className=`
 * when there's a `<Table>` primitive, etc.
 *
 * The discipline (per `apps/docs/src/reference/admin-ui/component-conventions.md`):
 * if a primitive exists, USE IT. Inline duplication of what should be a primitive
 * accumulates as cleanup debt.
 *
 * v1 audit is grep-based — fast, simple, catches the obvious cases. v2 may add
 * AST-aware detection if false positives or subtle drift become a problem. Until
 * then: simple > clever.
 *
 * Files in `src/components/ui/` are EXEMPT — those ARE the primitives, they're
 * allowed (and required) to use the underlying HTML elements.
 *
 * Test files (`*.test.tsx?`) and the audit itself are also exempt — tests
 * intentionally use raw HTML for assertion targets, mocks, and stubs.
 *
 * The second describe is the component scan (storybook-components A1, A3):
 * `looks/components` reads every `data-component` marker in the app's declared
 * sources and refuses one name in two files and a marker written out outside
 * its component's file. It is the same scan `indusk looks lint admin` runs.
 */

const ADMIN_ROOT = path.resolve(__dirname, "../..");
const SRC_DIR = path.join(ADMIN_ROOT, "src");
const UI_PRIMITIVES_DIR = path.join(SRC_DIR, "components/ui");

const PATTERNS: Array<{ name: string; primitive: string; regex: RegExp }> = [
  { name: "<button>", primitive: "Button", regex: /<button\b[^>]*className=/ },
  { name: "<table>", primitive: "Table", regex: /<table\b[^>]*className=/ },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (
      path.extname(entry) === ".tsx" ||
      path.extname(entry) === ".ts"
    ) {
      out.push(full);
    }
  }
  return out;
}

function isExempt(file: string): boolean {
  if (file.startsWith(UI_PRIMITIVES_DIR)) return true;
  if (file.endsWith(".test.tsx") || file.endsWith(".test.ts")) return true;
  if (file.includes("__tests__")) return true;
  // Markdown.tsx is the bridge that wires react-markdown's `<table>`/`<th>`/
  // `<td>` element overrides to the project's Table primitive. The audit's
  // grep flags any line with `<table className=` — including doc-comment
  // examples explaining the discipline ("no inline `<table className=...>`
  // anywhere"). Exempt this file so the comment doesn't trip the audit.
  if (file.endsWith("/Markdown.tsx")) return true;
  return false;
}

describe("T16 — component-reuse audit", () => {
  it("no inline JSX uses HTML primitives where a UI primitive exists", () => {
    const violations: string[] = [];
    const files = walk(SRC_DIR).filter((f) => !isExempt(f));

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const p of PATTERNS) {
          if (p.regex.test(line)) {
            violations.push(
              `${path.relative(ADMIN_ROOT, file)}:${i + 1} — found inline ${p.name} with className; use <${p.primitive}> instead.`,
            );
          }
        }
      }
    }

    // Verbose failure message — when this fails, the dev sees exactly which
    // file/line is the culprit and what to do.
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("audit ran against a non-empty file set (sanity)", () => {
    const files = walk(SRC_DIR).filter((f) => !isExempt(f));
    expect(files.length).toBeGreaterThan(0);
  });
});

describe("component scan — one implementation per component", () => {
  it("no component is marked in two files, and no screen writes a component's marker out", async () => {
    const repoRoot = path.resolve(ADMIN_ROOT, "../..");
    const app = await readApp(repoRoot, "admin");
    const { components, findings } = await scanComponents(repoRoot, app);
    // A scan that read nothing would pass for the wrong reason.
    expect(components.size).toBeGreaterThan(0);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.message}`)).toEqual([]);
  });
});
