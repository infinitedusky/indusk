import type { PlanPosition } from "@infinitedusky/indusk-mcp/lifecycle";
import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import type { DecisionEntry } from "@infinitedusky/indusk-mcp/plans/history";
import {
  planWaiting,
  type WaitingSession,
} from "@infinitedusky/indusk-mcp/plans/waiting";
import type { Proof } from "@infinitedusky/indusk-mcp/promises/proof";
import type {
  IncidentEntry,
  PromiseEntry,
  Registry,
} from "@infinitedusky/indusk-mcp/promises/registry";
import { snapshotOf } from "@/lib/plan-snapshot";
import type { Plan } from "@/lib/planning-reader";

/**
 * The cockpit's fixture project (plan-cockpit, Test Phase 1): what the
 * layout, the plan page and the promises page read, as plain data. The
 * admin's browser tests mock the `@/lib/*` readers (and the package's health
 * read) from it, the way `plan/[name]/page.test.tsx` mocks them today — so
 * nothing here touches `node:fs`, and it loads in the browser project.
 *
 * Shape:
 *   - forty active plans. Twelve are declared by master files: three Paths
 *     (`path-alpha`, `path-beta`, `path-gamma`), `path-alpha` holding
 *     `path-alpha-inner` holding `path-deep` (three levels), and `path-deep`
 *     naming its own ancestor `path-alpha` (a cycle the walk must stop at).
 *   - `undeclared-plan` is declared nowhere.
 *   - `fix-double-booking` (a bugfix), `mid-build`, `at-review`,
 *     `skipped-ritual` and `adr-flip` carry the plan page's fixtures.
 *   - `asking-plan` (its planning session has asked a question) and
 *     `awaiting-approval` (an impl draft) wait on the person, with
 *     `at-review` (Build Phase 6's Needs you).
 *   - a registry of promises, two of them broken, one with every row passing
 *     (that standing is derived by Build Phase 1's `promises/standing`; here
 *     it is only a promise whose health reads red).
 *   - release dates for some plans.
 */

export const PROJECT = "cockpit-proj";
export const PROJECT_PATH = "/mock/cockpit-proj";
export const NOW = "2026-10-10T10:00:00.000Z";

// -- the master files -------------------------------------------------------

export const DECLARATIONS: PlanDeclarations = {
  root: { name: "master", title: "Cockpit project" },
  parents: ["path-alpha", "path-beta", "path-gamma"],
  roadmap: ["path-alpha", "path-beta", "path-gamma"],
  subplans: {
    "path-alpha": ["alpha-one", "alpha-two", "path-alpha-inner"],
    "path-alpha-inner": ["inner-one", "path-deep"],
    // `path-alpha` is path-deep's own ancestor: the walk stops at the repeat.
    "path-deep": ["deep-one", "path-alpha"],
    "path-beta": ["beta-one", "beta-two"],
    "path-gamma": ["gamma-one"],
  },
};

/** Every plan the master files declare, in declared (depth-first) order. */
export const DECLARED_PLANS = [
  "path-alpha",
  "alpha-one",
  "alpha-two",
  "path-alpha-inner",
  "inner-one",
  "path-deep",
  "deep-one",
  "path-beta",
  "beta-one",
  "beta-two",
  "path-gamma",
  "gamma-one",
] as const;

// -- plans ------------------------------------------------------------------

const POSITIONS = [
  "research",
  "brief",
  "test-plan",
  "adr",
  "impl-approved",
  "executing",
  "falsify",
  "cleanup",
  "audit",
  "review",
  "accepted",
  "retrospective",
  "archived",
  "monitor",
] as const satisfies readonly PlanPosition[];

function position(current: PlanPosition): NonNullable<Plan["position"]> {
  const at = POSITIONS.indexOf(current);
  const segments = {} as NonNullable<Plan["position"]>["segments"];
  for (const [i, p] of POSITIONS.entries()) {
    segments[p] = i < at ? "done" : i === at ? "active" : "pending";
  }
  return { position: current, segments, awaiting: null };
}

const TITLES: Record<string, string> = {
  "alpha-one": "Seat holds rework",
  "beta-one": "Checkout rebuild",
  "beta-two": "Receipts and refunds",
  "gamma-one": "Search ranking",
  "undeclared-plan": "Loose ends",
};

interface DocSpec {
  status?: string;
}

interface PlanSpec {
  name: string;
  workflow?: "feature" | "bugfix";
  status?: string;
  at?: PlanPosition;
  docs?: Partial<
    Record<"research" | "brief" | "testPlan" | "adr" | "impl", DocSpec>
  >;
  skipped?: NonNullable<Plan["skippedRituals"]>;
}

function doc(status: string | undefined, title?: string) {
  return {
    frontmatter: { ...(status ? { status } : {}), ...(title ? { title } : {}) },
    content: "",
  };
}

function build(spec: PlanSpec): Plan {
  const { name, docs = {} } = spec;
  const title = TITLES[name] ?? name;
  const plan: Plan = {
    name,
    status: spec.status ?? "in-progress",
    archived: false,
    workflow: spec.workflow ?? "feature",
    ...(spec.at ? { position: position(spec.at) } : {}),
    ...(spec.skipped ? { skippedRituals: spec.skipped } : {}),
  };
  if (docs.research) plan.research = doc(docs.research.status);
  plan.brief = doc(docs.brief?.status ?? "accepted", `${title} — brief`);
  if (docs.testPlan) plan.testPlan = doc(docs.testPlan.status);
  if (docs.adr) plan.adr = doc(docs.adr.status);
  if (docs.impl) plan.impl = doc(docs.impl.status);
  return plan;
}

const ALL_DOCS: PlanSpec["docs"] = {
  research: { status: "accepted" },
  brief: { status: "accepted" },
  testPlan: { status: "accepted" },
  adr: { status: "accepted" },
  impl: { status: "approved" },
};

/** A 950-character skip reason (skip-reason-why A3): a paragraph, not a sentence. */
export const LONG_SKIP_REASON =
  `${"Reviewed every changed region and found nothing that warrants this ritual. ".repeat(13)}`.slice(
    0,
    950,
  );

/** The plan page's fixtures. */
const PAGE_PLANS: PlanSpec[] = [
  {
    name: "fix-double-booking",
    workflow: "bugfix",
    at: "executing",
    docs: {
      brief: { status: "accepted" },
      testPlan: { status: "accepted" },
      impl: { status: "approved" },
    },
  },
  { name: "mid-build", at: "executing", docs: ALL_DOCS },
  { name: "at-review", at: "review", docs: ALL_DOCS },
  {
    name: "skipped-ritual",
    at: "cleanup",
    docs: ALL_DOCS,
    skipped: [{ ritual: "falsification", reason: "a docs-only plan" }],
  },
  {
    // skip-reason-why A3: a reason far past one sentence; the status must stay "skipped".
    name: "skipped-ritual-long",
    at: "cleanup",
    docs: ALL_DOCS,
    skipped: [{ ritual: "falsification", reason: LONG_SKIP_REASON }],
  },
  {
    // skip-reason-why A10: an audit skipped with a one-sentence reason. Not at
    // review: a plan there waits on the person, and Needs you would list it.
    name: "skipped-audit",
    at: "executing",
    docs: ALL_DOCS,
    skipped: [
      { ritual: "audit", reason: "a docs-only plan, nothing to audit" },
    ],
  },
  {
    name: "asking-plan",
    at: "brief",
    docs: { research: { status: "complete" }, brief: { status: "draft" } },
  },
  {
    name: "awaiting-approval",
    at: "impl-approved",
    docs: { ...ALL_DOCS, impl: { status: "draft" } },
  },
  {
    name: "adr-flip",
    at: "adr",
    docs: {
      research: { status: "accepted" },
      brief: { status: "accepted" },
      testPlan: { status: "accepted" },
      adr: { status: "proposed" },
    },
  },
];

function initialSpecs(): PlanSpec[] {
  const declared = DECLARED_PLANS.map((name): PlanSpec => ({ name }));
  const loose: PlanSpec[] = [{ name: "undeclared-plan" }, ...PAGE_PLANS];
  const used = declared.length + loose.length;
  const filler = Array.from(
    { length: 40 - used },
    (_, i): PlanSpec => ({
      name: `filler-plan-${String(i + 1).padStart(2, "0")}`,
    }),
  );
  return [...declared, ...loose, ...filler];
}

let plans: Plan[] = initialSpecs().map(build);

export function activePlans(): Plan[] {
  return plans;
}

export function archivedPlans(): Plan[] {
  return [];
}

/** Every active plan's name, in the order `activePlans` lists them. */
export function activePlanNames(): string[] {
  return plans.map((p) => p.name);
}

/** Put the fixture back as it was built. */
export function resetFixture(): void {
  plans = initialSpecs().map(build);
  looks = [];
}

/**
 * Change a plan the way a person changes it on disk: a document's status, and
 * where the plan then stands. The next read sees it; nothing is cached.
 */
export function changeOnDisk(
  name: string,
  change: { adrStatus?: string; at?: PlanPosition },
): void {
  plans = plans.map((p) => {
    if (p.name !== name) return p;
    return {
      ...p,
      ...(p.adr && change.adrStatus
        ? {
            adr: {
              ...p.adr,
              frontmatter: { ...p.adr.frontmatter, status: change.adrStatus },
            },
          }
        : {}),
      ...(change.at ? { position: position(change.at) } : {}),
    };
  });
}

// -- what plans wait on (Build Phase 6) ---------------------------------------

/** The running admin session: `asking-plan`'s planning session, which has asked. */
export const SESSIONS: WaitingSession[] = [
  {
    plan: "asking-plan",
    kind: "planning",
    question: {
      requestId: "req-1",
      questions: [
        {
          question: "Which seat map should holds use?",
          options: [{ label: "The venue's map" }, { label: "Our own grid" }],
        },
      ],
    },
  },
];

/** Plans that wait on the person, in nav order, with the step each waits at. */
export const WAITING = [
  ["at-review", "Review"],
  ["asking-plan", "Brief"],
  ["awaiting-approval", "Impl"],
] as const;

/** Each plan's recorded decisions. */
export const HISTORY: Record<string, DecisionEntry[]> = {
  "at-review": [
    {
      decision: "The plan is written. Approve it?",
      answer: "Approve",
      by: "person",
      at: "2026-10-01T09:00:00.000Z",
    },
  ],
};

// -- dates ------------------------------------------------------------------

export interface FixtureDates {
  started: string | null;
  landed: string | null;
  released: { version: string; date: string } | null;
}

const NONE: FixtureDates = {
  started: "2026-09-01",
  landed: null,
  released: null,
};

/** Released: alpha-one, inner-one, beta-one, deep-one. Landed, not released: alpha-two, beta-two. */
export const DATES: Record<string, FixtureDates> = {
  "alpha-one": {
    started: "2026-09-01",
    landed: "2026-09-10",
    released: { version: "1.60.0", date: "2026-09-12" },
  },
  "alpha-two": { started: "2026-09-02", landed: "2026-09-20", released: null },
  "inner-one": {
    started: "2026-09-03",
    landed: "2026-09-11",
    released: { version: "1.60.0", date: "2026-09-12" },
  },
  "deep-one": {
    started: "2026-09-04",
    landed: "2026-09-11",
    released: { version: "1.60.0", date: "2026-09-12" },
  },
  "beta-one": {
    started: "2026-09-05",
    landed: "2026-09-11",
    released: { version: "1.60.0", date: "2026-09-12" },
  },
  "beta-two": { started: "2026-09-06", landed: "2026-09-25", released: null },
};

export function datesOf(plan: string): FixtureDates {
  return DATES[plan] ?? NONE;
}

// -- promises ---------------------------------------------------------------

function promise(
  name: string,
  owner: string,
  statement: string,
  state: PromiseEntry["state"] = "enforced",
): PromiseEntry {
  return {
    name,
    kind: "behaviour",
    lifetime: "holds",
    state,
    domain: "booking",
    owner,
    statement,
    sites: [`src/${name}.ts`],
    tests: [`src/${name}.test.ts`],
    incidents: [],
    aliases: [],
    file: `${name}.md`,
  };
}

export const PROMISES: PromiseEntry[] = [
  promise(
    "seat-holds-never-double-book",
    "alpha-one",
    "Two guests are never given the same seat.",
  ),
  promise(
    "checkout-never-charges-twice",
    "beta-one",
    "A card is charged once per order.",
  ),
  promise(
    "receipts-arrive-within-a-minute",
    "beta-two",
    "A receipt is emailed within sixty seconds of payment.",
  ),
  promise(
    "refunds-reach-the-card",
    "beta-one",
    "A refund shows on the card statement.",
  ),
  promise(
    "search-results-stay-sorted",
    "gamma-one",
    "Search results keep the order the guest chose.",
  ),
  promise(
    "exports-keep-their-columns",
    "undeclared-plan",
    "A CSV export keeps its columns in order.",
    "declared",
  ),
];

export const INCIDENTS: IncidentEntry[] = [];

export const REGISTRY: Registry = {
  dir: `${PROJECT_PATH}/.indusk/promises`,
  promises: PROMISES,
  incidents: INCIDENTS,
};

/** The two broken promises, the latest break first. */
export const BROKEN = [
  "checkout-never-charges-twice",
  "seat-holds-never-double-book",
] as const;

/** When each promise was last seen (ISO); null for one never seen. */
export const LAST_SEEN: Record<string, string | null> = {
  "checkout-never-charges-twice": "2026-10-10T08:00:00.000Z",
  "seat-holds-never-double-book": "2026-10-09T12:00:00.000Z",
  "receipts-arrive-within-a-minute": "2026-10-10T09:00:00.000Z",
  "refunds-reach-the-card": "2026-10-07T09:00:00.000Z",
  "search-results-stay-sorted": "2026-10-08T09:00:00.000Z",
  "exports-keep-their-columns": null,
};

/** The alarm source's reading of each promise, as `healthRows` returns it. */
export function healthRowsFixture() {
  const rows: Record<
    string,
    {
      health: "red" | "green" | "unverified";
      violations: number | null;
      lastSeen: string | null;
    }
  > = {};
  for (const p of PROMISES) {
    const lastSeen = LAST_SEEN[p.name] ?? null;
    const broken = (BROKEN as readonly string[]).includes(p.name);
    rows[p.name] = {
      health: broken ? "red" : lastSeen ? "green" : "unverified",
      violations: broken ? 1 : lastSeen ? 0 : null,
      lastSeen,
    };
  }
  return rows;
}

/** The plans owning a broken promise — `redPlans`' answer. */
export function redPlansFixture(): Set<string> {
  return new Set(
    PROMISES.filter((p) => (BROKEN as readonly string[]).includes(p.name)).map(
      (p) => p.owner,
    ),
  );
}

/** One health read that answered, as `readHealth` returns it for a local-only project. */
export function readsFixture() {
  return [
    {
      name: "local",
      label: "http://localhost:16686",
      ok: true as const,
      at: NOW,
      marks: { byPromise: new Map() },
    },
  ];
}

export function titleOf(plan: string): string {
  return TITLES[plan] ?? plan;
}

// -- module mocks -----------------------------------------------------------
//
// Factories for `vi.mock(path, () => …)`: each returns every export the
// cockpit's layout and pages import from that module (a mock must cover them
// all — the admin's known gotcha). A page that comes to import another reader
// adds it here once, for every cockpit test.

export function planningReaderMock() {
  return {
    __esModule: true,
    readActivePlans: async () => activePlans(),
    readArchivedPlans: async () => archivedPlans(),
    readProjectWorktrees: async () => ({ ok: true, unassigned: [] }),
    readPlanHierarchy: () => DECLARATIONS,
    readPlanMasterContent: async () => null,
  };
}

export function promisesReaderMock() {
  return {
    __esModule: true,
    readProjectPromises: () => ({ ok: true, registry: REGISTRY }),
    registryOf: () => REGISTRY,
    holdingCount: () => 0,
    holdingCounts: () => new Map<string, number>(),
  };
}

export function healthMock() {
  return {
    __esModule: true,
    readHealth: async () => readsFixture(),
    alarmRead: (reads: ReturnType<typeof readsFixture>) => reads[0],
    ruleFor: () => "incidents",
    healthRows: () => healthRowsFixture(),
    redPlans: () => redPlansFixture(),
  };
}

export function registryClientMock() {
  return {
    __esModule: true,
    readRegistryProjects: () => [
      { name: PROJECT, path: PROJECT_PATH },
      { name: "other-proj", path: "/mock/other" },
    ],
    getProjectPath: (name: string) => (name === PROJECT ? PROJECT_PATH : null),
    projectPathExists: () => true,
  };
}

/**
 * The package's display module, answered from the fixture. The real module
 * reads files when it loads, so a browser test cannot import it; this stands
 * in with the same four functions. `promiseWords` here is only the stand-in's
 * plain reading (hyphens to spaces, first letter capital) — the tests assert
 * literal sentences, so a page that names promises by anything else fails.
 */
export function displayMock() {
  const planTitles: Record<string, string> = {};
  for (const p of activePlans()) planTitles[p.name] = titleOf(p.name);
  return {
    __esModule: true,
    promiseWords: (name: string) => {
      const words = name.split("-").join(" ");
      return words.charAt(0).toUpperCase() + words.slice(1);
    },
    planTitle: (title: string | undefined, folder: string) =>
      title?.split(" — ")[0]?.trim() || folder,
    displayWords: () => ({}),
    planDates: (planDir: string) => datesOf(planDir.split("/").pop() ?? ""),
    readHealthNames: () => ({
      planTitles,
      planDates: DATES,
      words: {},
    }),
  };
}

/** `promises/sources` reads the project's config at import; the page needs only the pure choice of alarm source. */
export function sourcesMock() {
  return {
    __esModule: true,
    alarmSource: (names: string[]) =>
      names.includes("production") ? "production" : "local",
  };
}

/**
 * `lib/timeline-strip` reaches `promises/incidents`, which reads files as it
 * loads; the dashboard draws no timeline from the fixture, so only the window
 * parse the page makes is answered.
 */
export function timelineStripMock() {
  return {
    __esModule: true,
    parseWindow: () => "7d",
    WINDOWS: { "7d": { ms: 7 * 86_400_000, cells: 84 } },
    DEFAULT_WINDOW: "7d",
  };
}

/**
 * `promises/standing` reads the registry and every plan's rows from disk as it
 * loads; a browser test stands in with the same `readStanding`, answered from
 * the fixture: the two broken promises broken, the declared one declared,
 * the rest enforced, each with one passing test row.
 */
export function standingMock() {
  return {
    __esModule: true,
    readStanding: async () =>
      PROMISES.map((entry) => {
        const broken = (BROKEN as readonly string[]).includes(entry.name);
        const standing = broken
          ? "broken"
          : entry.state === "declared"
            ? "declared"
            : "enforced";
        const total = standing === "declared" ? 0 : 1;
        return {
          entry,
          rows: [],
          standing,
          health: {},
          tests: { passing: total, total },
          lastActivity: LAST_SEEN[entry.name] ?? null,
          thirtyDays: PROOFS[entry.name]?.standing.thirtyDays ?? {
            broke: 0,
            held: LAST_SEEN[entry.name] ? 30 : null,
          },
          lastBreak: broken ? (LAST_SEEN[entry.name] ?? null) : null,
        };
      }),
    readLookStanding: async () => ({
      rows: looks,
      problems: [],
      runs: { ok: true as const },
    }),
  };
}

// -- looks (ui-promises, Build Phase 4) ----------------------------------------

/** One look's row, as `promises/standing`'s `readLookStanding` returns it. */
export interface FixtureLook {
  app: string;
  look: string;
  kind: "screen" | "component";
  device: string | null;
  standing: "broken" | "held" | "unchecked" | "uncovered";
  word: string;
  at: string | null;
  symptom: string | null;
}

/** No looks by default: a project without mockups, as every cockpit test before ui-promises assumed. */
let looks: FixtureLook[] = [];

/** The looks the next read returns; `resetFixture` puts them back to none. */
export function setLooks(next: FixtureLook[]): void {
  looks = next;
}

// -- a promise's proof (Build Phase 3) -----------------------------------------

/** Thirty UTC days ending 2026-10-10 (the fixture's today), oldest first. */
function thirtyDays(
  perDay: Record<string, { held?: number; broken?: number }> = {},
) {
  const end = Date.UTC(2026, 9, 10);
  return Array.from({ length: 30 }, (_, i) => {
    const day = new Date(end - (29 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return {
      day,
      held: perDay[day]?.held ?? 0,
      broken: perDay[day]?.broken ?? 0,
    };
  });
}

/** The day a violation was recorded while no admin page was open (A30). */
export const HEARD_DAY = "2026-10-08";

const NO_TIME = { lastActivity: null, lastBreak: null } as const;

/**
 * `promises/proof`'s answer for each promise the page test names: the broken
 * one whose every test passes (A29), the broken one whose tests are not all
 * passing, one that holds, and one never seen.
 */
export const PROOFS: Record<string, Proof> = {
  "seat-holds-never-double-book": {
    standing: {
      standing: "broken",
      tests: { passing: 2, total: 2 },
      health: { local: "red", production: "red" },
      lastActivity: "2026-10-09T12:00:00.000Z",
      lastBreak: "2026-10-09T12:00:00.000Z",
      thirtyDays: { broke: 3, held: 28 },
    },
    broken: {
      promise: "seat-holds-never-double-book",
      source: "production",
      sourceLabel: "https://jaeger.example",
      statement: "Two guests are never given the same seat.",
      symptom: "seat 4 held twice",
      traceId: "abc123",
      tests: ["src/seat-holds-never-double-book.test.ts"],
    },
    rows: [
      {
        id: "A1",
        state: "passing",
        tests: ["src/seats/hold.test.ts"],
        plan: "alpha-one",
        archived: false,
      },
      {
        id: "A4",
        state: "passing",
        tests: ["src/seats/release.test.ts", "src/seats/race.test.ts"],
        plan: "old-seat-rework",
        archived: true,
      },
    ],
    unreadable: [],
    marks: [
      {
        service: "seat-holds",
        operation: "hold",
        lastHeld: "2026-10-10T07:00:00.000Z",
        lastBroken: "2026-10-09T12:00:00.000Z",
      },
      {
        service: "seat-holds",
        operation: "release",
        lastHeld: "2026-10-09T07:00:00.000Z",
        lastBroken: null,
      },
    ],
    seen: true,
    days: {
      local: thirtyDays({ "2026-10-09": { held: 4 } }),
      production: thirtyDays({
        [HEARD_DAY]: { broken: 2 },
        "2026-10-09": { held: 1, broken: 1 },
      }),
    },
    unread: {},
    history: [
      { at: "2026-09-01", kind: "declared", text: "declared by alpha-one" },
      {
        at: "2026-09-12",
        kind: "confirmed",
        text: "enforced when alpha-one closed",
      },
      { at: "2026-10-10", kind: "incident", text: "INC-7: seat 4 held twice" },
    ],
    banner: { testsMissTheCase: true },
  },
  "checkout-never-charges-twice": {
    standing: {
      standing: "broken",
      tests: { passing: 1, total: 2 },
      health: { local: "red" },
      lastActivity: "2026-10-10T08:00:00.000Z",
      lastBreak: "2026-10-10T08:00:00.000Z",
      thirtyDays: { broke: 1, held: 29 },
    },
    broken: {
      promise: "checkout-never-charges-twice",
      source: "local",
      sourceLabel: "http://localhost:16686",
      statement: "A card is charged once per order.",
      tests: ["src/checkout-never-charges-twice.test.ts"],
    },
    rows: [
      {
        id: "A2",
        state: "passing",
        tests: ["src/checkout/charge.test.ts"],
        plan: "beta-one",
        archived: false,
      },
      {
        id: "A3",
        state: "written",
        tests: ["src/checkout/retry.test.ts"],
        plan: "beta-one",
        archived: false,
      },
    ],
    unreadable: [],
    marks: [],
    seen: false,
    days: { local: thirtyDays({ "2026-10-10": { broken: 1 } }) },
    unread: {},
    history: [],
    banner: { testsMissTheCase: false },
  },
  "receipts-arrive-within-a-minute": {
    standing: {
      standing: "enforced",
      tests: { passing: 1, total: 1 },
      health: { local: "green" },
      lastActivity: "2026-10-10T09:00:00.000Z",
      lastBreak: null,
      thirtyDays: { broke: 0, held: 30 },
    },
    broken: null,
    rows: [
      {
        id: "A1",
        state: "passing",
        tests: ["src/receipts.test.ts"],
        plan: "beta-two",
        archived: false,
      },
    ],
    unreadable: [],
    marks: [
      {
        service: "receipts",
        operation: "send",
        lastHeld: "2026-10-10T09:00:00.000Z",
        lastBroken: null,
      },
    ],
    seen: true,
    days: { local: thirtyDays({ "2026-10-10": { held: 6 } }) },
    unread: {},
    history: [
      { at: "2026-09-25", kind: "declared", text: "declared by beta-two" },
    ],
    banner: { testsMissTheCase: false },
  },
  "exports-keep-their-columns": {
    standing: {
      standing: "declared",
      tests: { passing: 0, total: 0 },
      health: {},
      ...NO_TIME,
      thirtyDays: { broke: 0, held: null },
    },
    broken: null,
    rows: [],
    unreadable: [],
    marks: [],
    seen: false,
    days: { local: thirtyDays() },
    unread: {},
    history: [],
    banner: { testsMissTheCase: false },
  },
};

/**
 * The admin's decisions reader, answered from the fixture through the
 * package's real `planWaiting`: the session above, the plans as they are now.
 */
export function decisionsReaderMock() {
  return {
    __esModule: true,
    readWaiting: (_project: string, plans: Plan[]) =>
      planWaiting({ sessions: SESSIONS, plans: plans.map(snapshotOf) }),
    readPlanHistory: (_path: string, plan: string) => HISTORY[plan] ?? [],
  };
}

/** `promises/proof` answered from the fixture; a name the registry lacks is null, as the real one answers. */
export function proofMock() {
  return {
    __esModule: true,
    proofOf: async (_root: string, name: string) => PROOFS[name] ?? null,
  };
}
