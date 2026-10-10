import type { PlanPosition } from "@infinitedusky/indusk-mcp/lifecycle";
import type { PlanDeclarations } from "@infinitedusky/indusk-mcp/planning/plan-parser";
import type {
  IncidentEntry,
  PromiseEntry,
  Registry,
} from "@infinitedusky/indusk-mcp/promises/registry";
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

// -- dates ------------------------------------------------------------------

export interface FixtureDates {
  started: string | null;
  landed: string | null;
  released: { version: string; date: string } | null;
}

const NONE: FixtureDates = { started: "2026-09-01", landed: null, released: null };

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
    lifetime: "permanent",
    state,
    domain: "booking",
    owner,
    statement,
    sites: [`src/${name}.ts`],
    tests: [`src/${name}.test.ts`],
    incidents: [],
    aliases: [],
    file: `${name}.md`,
  } as PromiseEntry;
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
    PROMISES.filter((p) =>
      (BROKEN as readonly string[]).includes(p.name),
    ).map((p) => p.owner),
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
