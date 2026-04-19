import { readdirSync, readFileSync, statSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * T16 — component-reuse audit.
 *
 * Walks `apps/indusk-admin/src/` for `.tsx` files. For each, looks for inline
 * JSX patterns where a corresponding primitive in `src/components/ui/` exists
 * — e.g., `<button className=` when there's a `<Button>` primitive, `<table className=`
 * when there's a `<Table>` primitive, etc.
 *
 * The discipline (per `apps/indusk-docs/src/reference/admin-ui/component-conventions.md`):
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
