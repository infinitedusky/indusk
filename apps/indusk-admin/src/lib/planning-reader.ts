import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  isFalsificationComplete,
  type LogEntry,
  readFalsificationLog,
} from "@infinitedusky/indusk-mcp/falsification/log";
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
  brief?: BriefData;
  testPlan?: TestPlanData;
  adr?: ADRData;
  impl?: ImplData;
  falsification?: FalsificationData;
  retrospective?: RetroData;
  /** True when ANY document in the plan failed to parse (malformed YAML frontmatter). */
  malformed?: boolean;
}

export interface Scorecard {
  timestamp: string;
  changeId?: string;
  mode?: string;
  summary?: string;
  questions?: unknown;
  graphitiWrites?: number;
  [key: string]: unknown;
}

const PLANNING_DIR = ".indusk/planning";
const ARCHIVE_DIR = "archive";
const EVAL_RESULTS = ".indusk/eval/results.log";
const MASTER_FILE = "master.md";

const DOC_FILES = [
  "brief.md",
  "test-plan.md",
  "adr.md",
  "impl.md",
  "falsification.md",
  "retrospective.md",
] as const;

/**
 * Read a single document file and return parsed frontmatter + content. Returns
 * `null` if the file doesn't exist. Returns `{ malformed: true }` if gray-matter
 * fails to parse the frontmatter (e.g., unterminated quoted string).
 */
async function readDoc(
  planDir: string,
  filename: string,
): Promise<
  | { frontmatter: DocumentFrontmatter; content: string }
  | { malformed: true }
  | null
> {
  const path = join(planDir, filename);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = matter(raw);
    return {
      frontmatter: parsed.data as DocumentFrontmatter,
      content: parsed.content,
    };
  } catch {
    return { malformed: true };
  }
}

function isMalformed(
  doc:
    | { malformed: true }
    | { frontmatter: DocumentFrontmatter; content: string }
    | null,
): doc is { malformed: true } {
  return doc !== null && "malformed" in doc;
}

async function readPlanFolder(
  planDir: string,
  name: string,
  archived: boolean,
): Promise<Plan> {
  const docs = await Promise.all(DOC_FILES.map((f) => readDoc(planDir, f)));
  const [brief, testPlan, adr, impl, _falsification, retrospective] = docs;
  const malformed = docs.some((d) => isMalformed(d));

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
    ...(malformed ? { malformed: true } : {}),
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
export function readMasterPlanOrder(projectRoot: string): string[] {
  const masterPath = join(projectRoot, PLANNING_DIR, MASTER_FILE);
  if (!existsSync(masterPath)) return [];
  const raw = readFileSync(masterPath, "utf-8");
  const order: string[] = [];
  const seen = new Set<string>();
  const linkRe = /\[([a-z0-9-]+)\]\(\1\/[a-z0-9-]+\.md\)/gi;
  for (const match of raw.matchAll(linkRe)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      order.push(name);
    }
  }
  return order;
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
