import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isFalsificationComplete,
  type LogEntry,
  readFalsificationLog,
} from "@infinitedusky/indusk-mcp/falsification/log";
import {
  type PlanDeclarations,
  readPlanDeclarations,
} from "@infinitedusky/indusk-mcp/planning/plan-parser";
import {
  parseTrajectory,
  type Trajectory,
} from "@infinitedusky/indusk-mcp/trajectory/parser";
import matter from "gray-matter";

/**
 * The data layer for the admin UI. Reads `.indusk/planning/` and `.indusk/eval/`
 * directly from disk and reuses indusk-mcp's parsers (trajectory + falsification log)
 * — never duplicates parsing logic. If a parser needs a new export to support the
 * admin UI, add it to the original module rather than recreating it here.
 *
 * Server-side only (filesystem access). Designed to be called from Next.js server
 * components, not from client components.
 */

export interface DocumentFrontmatter {
  title?: string;
  status?: string;
  workflow?: string;
  date?: string;
  [key: string]: unknown;
}

export interface ResearchData {
  frontmatter: DocumentFrontmatter;
  content: string;
}

export interface BriefData {
  frontmatter: DocumentFrontmatter;
  content: string;
}

export interface TestPlanData {
  frontmatter: DocumentFrontmatter;
  content: string;
}

export interface ADRData {
  frontmatter: DocumentFrontmatter;
  content: string;
}

export interface ImplData {
  frontmatter: DocumentFrontmatter;
  content: string;
  /** Parsed trajectory; undefined when the impl has no `## Test Trajectory` section. */
  trajectory?: Trajectory;
}

export interface FalsificationData {
  entries: LogEntry[];
  complete: boolean;
}

export interface RetroData {
  frontmatter: DocumentFrontmatter;
  content: string;
}

export interface Plan {
  /** Folder name (kebab-case) under `.indusk/planning/` or `.indusk/planning/archive/`. */
  name: string;
  /** Effective status — pulled from impl.md, falling back to brief.md, or "unknown". */
  status: string;
  /** Whether the plan lives under archive/ vs the active planning dir. */
  archived: boolean;
  research?: ResearchData;
  brief?: BriefData;
  testPlan?: TestPlanData;
  adr?: ADRData;
  impl?: ImplData;
  falsification?: FalsificationData;
  retrospective?: RetroData;
  /** True when ANY document in the plan failed to parse (malformed YAML frontmatter). */
  malformed?: boolean;
  /**
   * For each document that failed to parse, the raw file contents (so the UI
   * can show a "Raw" view per T13). Only populated when `malformed: true`.
   * Keys match the document filenames (e.g., `brief.md`, `impl.md`).
   */
  rawDocuments?: Record<string, string>;
}

export interface Scorecard {
  timestamp: string;
  changeId?: string;
  mode?: string;
  summary?: string;
  questions?: unknown;
  graphitiWrites?: number;
  /**
   * Registered project name — injected by the cross-project scorecards
   * walker (`app/scorecards/page.tsx`) after reading each project's
   * results.log. Not present in the underlying log file.
   */
  project?: string;
  [key: string]: unknown;
}

const PLANNING_DIR = ".indusk/planning";
const ARCHIVE_DIR = "archive";
const EVAL_RESULTS = ".indusk/eval/results.log";
const MASTER_FILE = "master.md";

const DOC_FILES = [
  "research.md",
  "brief.md",
  "test-plan.md",
  "adr.md",
  "impl.md",
  "falsification.md",
  "retrospective.md",
] as const;

/**
 * Read a single document file and return parsed frontmatter + content. Returns
 * `null` if the file doesn't exist. Returns `{ malformed: true }` if the
 * frontmatter cannot be parsed.
 *
 * Detection strategy: gray-matter is unreliable about throwing on malformed
 * YAML — depending on the runtime / module-resolution path, js-yaml errors
 * may be swallowed and `data: {}` returned instead. We detect malformed by
 * the structural signal: a file that starts with `---\n` and has a closing
 * `---` MUST yield a non-empty frontmatter block. If gray-matter returns a
 * truly empty `data` for such a file (and the block isn't actually empty
 * after trimming comments/whitespace), the parse silently failed.
 *
 * False-positive note: a legitimately empty frontmatter (`---\n---\nbody`)
 * also produces `data: {}` but with an empty block — we differentiate by
 * checking whether the block is non-trivial.
 */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

async function readDoc(
  planDir: string,
  filename: string,
): Promise<
  | { frontmatter: DocumentFrontmatter; content: string }
  | { malformed: true; raw: string }
  | null
> {
  const path = join(planDir, filename);
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch {
    return { malformed: true, raw: "" };
  }
  try {
    const parsed = matter(raw);
    const data = parsed.data as DocumentFrontmatter;
    const dataIsEmpty = Object.keys(data).length === 0;
    if (dataIsEmpty) {
      const fmMatch = raw.match(FRONTMATTER_RE);
      if (fmMatch) {
        const block = fmMatch[1].replace(/^\s*#[^\n]*$/gm, "").trim();
        if (block !== "") return { malformed: true, raw };
      }
    }
    return {
      frontmatter: data,
      content: parsed.content,
    };
  } catch {
    return { malformed: true, raw };
  }
}

function isMalformed(
  doc:
    | { malformed: true; raw: string }
    | { frontmatter: DocumentFrontmatter; content: string }
    | null,
): doc is { malformed: true; raw: string } {
  return doc !== null && "malformed" in doc;
}

async function readPlanFolder(
  planDir: string,
  name: string,
  archived: boolean,
): Promise<Plan> {
  const docs = await Promise.all(DOC_FILES.map((f) => readDoc(planDir, f)));
  const [research, brief, testPlan, adr, impl, _falsification, retrospective] =
    docs;
  const malformed = docs.some((d) => isMalformed(d));
  const rawDocuments: Record<string, string> = {};
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    if (doc !== null && isMalformed(doc)) {
      rawDocuments[DOC_FILES[i]] = doc.raw;
    }
  }

  let implData: ImplData | undefined;
  if (impl !== null && !isMalformed(impl)) {
    const trajectory = /^##\s+Test Trajectory\b/m.test(impl.content)
      ? parseTrajectory(impl.content)
      : undefined;
    implData = { ...impl, trajectory };
  }

  let falsificationData: FalsificationData | undefined;
  if (_falsification !== null) {
    try {
      const entries = readFalsificationLog(planDir);
      const complete = isFalsificationComplete(planDir);
      falsificationData = { entries, complete };
    } catch {
      // Library tolerates missing logs (returns []) but file-system errors
      // could throw. Treat as no-falsification rather than malformed-plan
      // since the file existing-but-unreadable is itself rare.
    }
  }

  const status =
    (implData?.frontmatter.status as string | undefined) ??
    (brief !== null && !isMalformed(brief)
      ? (brief.frontmatter.status as string | undefined)
      : undefined) ??
    "unknown";

  return {
    name,
    status,
    archived,
    research:
      research !== null && !isMalformed(research) ? research : undefined,
    brief: brief !== null && !isMalformed(brief) ? brief : undefined,
    testPlan:
      testPlan !== null && !isMalformed(testPlan) ? testPlan : undefined,
    adr: adr !== null && !isMalformed(adr) ? adr : undefined,
    impl: implData,
    falsification: falsificationData,
    retrospective:
      retrospective !== null && !isMalformed(retrospective)
        ? retrospective
        : undefined,
    ...(malformed ? { malformed: true, rawDocuments } : {}),
  };
}

async function listPlanFolders(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== ARCHIVE_DIR)
    .map((e) => e.name)
    .sort();
}

/**
 * Read every plan in `.indusk/planning/` (skipping `archive/`). Each plan
 * gets a `Plan` object with whatever documents are present; missing optional
 * documents result in `undefined` fields rather than errors.
 */
export async function readActivePlans(projectRoot: string): Promise<Plan[]> {
  const planningDir = join(projectRoot, PLANNING_DIR);
  const folders = await listPlanFolders(planningDir);
  return Promise.all(
    folders.map((name) => readPlanFolder(join(planningDir, name), name, false)),
  );
}

/**
 * Read every plan in `.indusk/planning/archive/`. Returns the same `Plan` shape
 * as `readActivePlans` but with `archived: true`.
 */
export async function readArchivedPlans(projectRoot: string): Promise<Plan[]> {
  const archiveDir = join(projectRoot, PLANNING_DIR, ARCHIVE_DIR);
  if (!existsSync(archiveDir)) return [];
  const entries = await readdir(archiveDir, { withFileTypes: true });
  const folders = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  return Promise.all(
    folders.map((name) => readPlanFolder(join(archiveDir, name), name, true)),
  );
}

/**
 * Parse `master.md` and return plan names in the order they appear in the
 * pipeline tables. Plan names come from markdown links like
 * `[plan-name](plan-name/brief.md)`. Plans listed by string only (no link)
 * are skipped — they don't have a folder yet.
 */
/**
 * Plan hierarchy declarations for this project — parents, top-level order, and
 * each parent's ordered children.
 *
 * Reads frontmatter through the shared parser rather than scraping prose. The
 * previous implementation matched markdown links shaped `[name](name/doc.md)`
 * with a regex, which silently matched *nothing* against a master whose links
 * carry a `../` prefix — structure derived from prose fails quietly, which is
 * the worst way for it to fail.
 */
export function readPlanHierarchy(projectRoot: string): PlanDeclarations {
  return readPlanDeclarations(join(projectRoot, PLANNING_DIR));
}

/**
 * Top-level display order. Plans absent from the declaration keep today's
 * behaviour — they fall through to the "Unordered" group rather than vanishing.
 */
export function readMasterPlanOrder(projectRoot: string): string[] {
  return readPlanHierarchy(projectRoot).roadmap;
}

/**
 * The prose body of a plan's own `master.md` — a parent plan's sequence and
 * its reasoning. Returns null when the file is absent or malformed; the
 * detail view simply omits the prose. Subplan cards never depend on it —
 * declarations come from `readPlanHierarchy`, not from here.
 */
export async function readPlanMasterContent(
  projectRoot: string,
  planName: string,
): Promise<string | null> {
  const doc = await readDoc(
    join(projectRoot, PLANNING_DIR, planName),
    MASTER_FILE,
  );
  if (doc === null || isMalformed(doc)) return null;
  return doc.content;
}

/**
 * Read `.indusk/eval/results.log` (jsonl, one scorecard per line) and return
 * scorecards filtered to the supplied date range. Malformed lines are skipped
 * silently — `results.log` is append-only and may contain partial entries from
 * crashed evaluator processes.
 */
export async function readEvalScorecards(
  projectRoot: string,
  planDateRange: { from: Date; to: Date },
): Promise<Scorecard[]> {
  const path = join(projectRoot, EVAL_RESULTS);
  if (!existsSync(path)) return [];
  const raw = await readFile(path, "utf-8");
  const out: Scorecard[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as Scorecard;
      if (typeof parsed.timestamp !== "string") continue;
      const ts = new Date(parsed.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      if (ts >= planDateRange.from && ts <= planDateRange.to) out.push(parsed);
    } catch {
      // Skip malformed lines — see fn doc.
    }
  }
  out.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  return out;
}

// The research-directory reader (.indusk/research/) lives in
// research-reader.ts — extracted in the dawn-ui-plan-grouping cleanup; it
// shares nothing with plan parsing.
