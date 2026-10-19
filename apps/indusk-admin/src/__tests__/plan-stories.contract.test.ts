// promise: a-master-plan-tells-its-story
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  writeConfig,
  writeLooksPlans,
  writePlan,
} from "@/__tests__/helpers/looks-fixtures";
import {
  type DevServer,
  makeHome,
  startNextBuilt,
} from "@/__tests__/helpers/next-dev";

/**
 * plan-stories A6 — `plan.master`, the retitled plan and nav screens and the
 * three `subplan-row` stories read approved, and the running admin holds each
 * by value at every reference device, against a fixture master with a plan in
 * each stage. A contract with Next, the built Storybook and Chromium, so the
 * system tier (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait).
 *
 * The throwaway project is registered as `dusk` and its master is named
 * `indusk-v4-day`, the path `screens.json` already declares for `plan.master`
 * and `subplan-row`, so the approved declaration is unchanged. Its plans are
 * one released (archived, named by a dated release), one in draft and one
 * declared with a title and description but no folder (queued). A named
 * screen the check never opened fails (`was never checked`) rather than
 * passing by omission.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const SCREENS = [
  "plan.master",
  "plan.parts",
  "plan.working",
  "plan.needs-you",
  "plan.released",
  "nav.expanded",
  "nav.wide",
];
const STORIES = [
  "subplan-row.released",
  "subplan-row.draft",
  "subplan-row.queued",
];

let base: string;
let server: DevServer;

/** The fixture master: a plan in each stage, the last declared with its own words. */
function writeMaster(project: string) {
  const planning = join(project, ".indusk", "planning");
  writeFileSync(
    join(planning, "master.md"),
    '---\ntitle: "Fixture project"\nparents: [indusk-v4-day]\nroadmap: [indusk-v4-day]\n---\n',
  );
  mkdirSync(join(planning, "indusk-v4-day"), { recursive: true });
  writeFileSync(
    join(planning, "indusk-v4-day", "master.md"),
    [
      "---",
      'title: "Fixture Day"',
      'description: "A master the look check opens, with a plan in each stage."',
      "subplans:",
      "  - looks-fixture-sub-released",
      "  - looks-fixture-sub-draft",
      "  - name: looks-fixture-sub-queued",
      '    title: "Queued fixture"',
      '    description: "Declared with its words, not started."',
      "---",
      "",
      "# Fixture Day",
      "",
    ].join("\n"),
  );
  writePlan(
    project,
    "looks-fixture-sub-released",
    { brief: "accepted", impl: "completed", approved: true },
    true,
  );
  writeFileSync(
    join(planning, "archive", "looks-fixture-sub-released", "retrospective.md"),
    "# Retrospective\n\nLanded on main at abc1234, 2026-10-01.\n",
  );
  writePlan(project, "looks-fixture-sub-draft", { brief: "draft" });
  writeFileSync(
    join(project, "CHANGELOG.md"),
    "# Changelog\n\n## [1.0.0] — 2026-10-02\n- **Sub** (looks-fixture-sub-released): shipped\n",
  );
}

beforeAll(async () => {
  if (!existsSync(join(ADMIN, "public/storybook/iframe.html"))) {
    const built = spawnSync("pnpm", ["run", "build:storybook"], {
      cwd: ADMIN,
      encoding: "utf-8",
      timeout: 570_000,
    });
    expect(built.status, built.stderr).toBe(0);
  }
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-plan-stories-")));
  const project = join(base, "proj");
  writeConfig(project, {
    workflow: {
      steps: {
        release: {
          command: "true",
          version_file: "package.json",
          changelog: "CHANGELOG.md",
        },
      },
    },
  });
  writeLooksPlans(project);
  writeMaster(project);
  server = await startNextBuilt({
    home: makeHome([{ name: "dusk", path: project }]),
  });
}, 600_000);

afterAll(async () => {
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

async function readLooks() {
  const { readAppLooks } = await import(
    "@infinitedusky/indusk-mcp/looks/overview"
  );
  const read = await readAppLooks(REPO, "admin");
  if ("problem" in read) throw new Error(read.problem);
  return read;
}

/** Open only what this plan names; `indusk looks check admin` holds the whole admin at landing. */
let sweep: ReturnType<typeof sweepNamed> | undefined;
const checkNamed = () => {
  sweep ??= sweepNamed();
  return sweep;
};

async function sweepNamed() {
  const { readApp } = await import("@infinitedusky/indusk-mcp/looks/mockups");
  const { readApprovals, readStoryApprovals } = await import(
    "@infinitedusky/indusk-mcp/looks/approvals"
  );
  const { checkApp } = await import("@infinitedusky/indusk-mcp/looks/check");
  const whole = await readApp(REPO, "admin");
  const app = {
    ...whole,
    screens: whole.screens
      .map((sc) => ({
        ...sc,
        states: sc.states.filter((st) => SCREENS.includes(`${sc.name}.${st}`)),
      }))
      .filter((sc) => sc.states.length > 0),
    stories: whole.stories.filter((st) => STORIES.includes(st.name)),
  };
  const checked = await checkApp(
    app,
    readApprovals(app),
    server.url,
    readStoryApprovals(app),
  );
  return { app, ...checked };
}

const of = (r: { screen: string; state: string }) => `${r.screen}.${r.state}`;

describe("A6 — plan-stories' screens and stories are approved and held", () => {
  it("A6 every screen and story this plan names reads approved", async () => {
    const read = await readLooks();
    for (const n of SCREENS)
      expect(read.mockups.find((m) => m.name === n)?.approval, n).toBe(
        "approved",
      );
    for (const n of STORIES)
      expect(read.stories.find((s) => s.name === n)?.approval, n).toBe(
        "approved",
      );
  }, 120_000);

  it("A6 the check opens every screen and story this plan names", async () => {
    const { results } = await checkNamed();
    for (const n of [...SCREENS, ...STORIES])
      expect(
        results.some((r) => of(r) === n),
        `${n} was never checked`,
      ).toBe(true);
  }, 580_000);

  it("A6 each is held by value at every reference device", async () => {
    const { app, results, unchecked } = await checkNamed();
    const named = [...SCREENS, ...STORIES];
    expect(
      results.filter(
        (r) => named.includes(of(r)) && r.verdict.state === "broken",
      ),
    ).toEqual([]);
    // Below 760 px the nav is a drawer with no edge to drag, so `nav.wide` is
    // not drawn at a phone's width and the page says so by not reporting it.
    const drawerDevices = app.devices
      .filter((d) => d.width < 760)
      .flatMap((d) => [d.name, `${d.name}/dark`]);
    expect(
      unchecked.filter(
        (u) =>
          (named.includes(u.mockup) ||
            STORIES.some((s) => u.mockup === `story ${s}`)) &&
          !(u.mockup === "nav.wide" && drawerDevices.includes(u.device ?? "")),
      ),
    ).toEqual([]);
  }, 580_000);
});
