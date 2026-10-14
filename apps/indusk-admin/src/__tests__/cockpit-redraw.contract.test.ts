// promise: a-plan-page-shows-the-parts-of-its-brief
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
  type DevServer,
  makeHome,
  startNextDev,
} from "@/__tests__/helpers/next-dev";

/**
 * cockpit-redraw A10 — every screen this plan names reads approved, and the
 * running admin holds it by value at each reference device, in a real browser.
 * A contract with Next, the built Storybook and Chromium, so the system tier
 * (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait).
 *
 * The looks are this repository's own (`readApp`); the admin they are held
 * against serves a throwaway project registered as `dusk`, because the
 * screens declare their pages under `/p/dusk/...` and one page cannot be a
 * plan in four conditions: `screens.json` lists a path per state, and the
 * project holds a fixture plan for each — `looks-fixture-parts` (brief being
 * written, so also `brief.writing`), `-working` (approved, so also
 * `brief.approved`), `-needs-you` (its impl waits on approval) and `-released`
 * (archived). A named screen that the check never opened fails (`was never
 * checked`) rather than passing by omission.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const SCREENS = [
  "nav.expanded",
  "nav.wide",
  "brief.writing",
  "brief.approved",
  "plan.parts",
  "plan.working",
  "plan.needs-you",
  "plan.released",
];
const STORIES = ["nav-handle.default", "nav-handle.dragging"];

let base: string;
let server: DevServer;

const doc = (status: string, extra = "") =>
  `---\ntitle: "fixture"\nstatus: ${status}\nworkflow: feature\n${extra}---\n\n# fixture\n`;
const brief = (status: string) =>
  doc(status, 'description: "A plan the look check opens in one condition."\n');
const impl = (status: string, extra = "") =>
  `${doc(status, extra)}\n## Checklist\n\n### Build Phase 1: One\n\n- [ ] an item\n`;

/** One fixture plan: its documents, each by its status; `archived` puts it under `archive/`. */
function plan(
  project: string,
  name: string,
  docs: { brief: string; impl?: string; approved?: boolean },
  archived = false,
) {
  const dir = join(
    project,
    ".indusk",
    "planning",
    ...(archived ? ["archive"] : []),
    name,
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "brief.md"), brief(docs.brief));
  if (docs.brief !== "accepted") return;
  for (const d of ["research", "test-plan", "adr"])
    writeFileSync(join(dir, `${d}.md`), doc("accepted"));
  if (docs.impl)
    writeFileSync(
      join(dir, "impl.md"),
      impl(docs.impl, docs.approved ? 'approved_brief: "abc"\n' : ""),
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
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-cockpit-redraw-")));
  const project = join(base, "proj");
  mkdirSync(join(project, ".indusk"), { recursive: true });
  writeFileSync(
    join(project, ".indusk", "config.json"),
    JSON.stringify({ mode: "full" }),
  );
  plan(project, "looks-fixture-parts", { brief: "draft" });
  plan(project, "looks-fixture-working", {
    brief: "accepted",
    impl: "in-progress",
    approved: true,
  });
  plan(project, "looks-fixture-needs-you", {
    brief: "accepted",
    impl: "draft",
  });
  plan(
    project,
    "looks-fixture-released",
    { brief: "accepted", impl: "completed", approved: true },
    true,
  );
  server = await startNextDev({
    home: makeHome([{ name: "dusk", path: project }]),
  });
}, 600_000);

afterAll(async () => {
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

describe("A10 — cockpit-redraw's screens are approved and held", () => {
  it("A10 every screen cockpit-redraw names is approved and held by value", async () => {
    const { readAppLooks } = await import(
      "@infinitedusky/indusk-mcp/looks/overview"
    );
    const { readApp } = await import("@infinitedusky/indusk-mcp/looks/mockups");
    const { readApprovals, readStoryApprovals } = await import(
      "@infinitedusky/indusk-mcp/looks/approvals"
    );
    const { checkApp } = await import("@infinitedusky/indusk-mcp/looks/check");

    const read = await readAppLooks(REPO, "admin");
    if ("problem" in read) throw new Error(read.problem);
    for (const n of SCREENS)
      expect(read.mockups.find((m) => m.name === n)?.approval, n).toBe(
        "approved",
      );
    for (const n of STORIES)
      expect(read.stories.find((s) => s.name === n)?.approval, n).toBe(
        "approved",
      );

    const whole = await readApp(REPO, "admin");
    const named = [...SCREENS, ...STORIES];
    // Open only what this plan names: the whole admin is held at landing by
    // `indusk looks check admin`, and opening every look here would be that
    // run again inside a test.
    const app = {
      ...whole,
      screens: whole.screens
        .map((sc) => ({
          ...sc,
          states: sc.states.filter((st) =>
            SCREENS.includes(`${sc.name}.${st}`),
          ),
        }))
        .filter((sc) => sc.states.length > 0),
      stories: whole.stories.filter((st) => STORIES.includes(st.name)),
    };
    const { results, unchecked } = await checkApp(
      app,
      readApprovals(app),
      server.url,
      readStoryApprovals(app),
    );
    const of = (r: { screen: string; state: string }) =>
      `${r.screen}.${r.state}`;
    for (const n of named)
      expect(
        results.some((r) => of(r) === n),
        `${n} was never checked`,
      ).toBe(true);
    expect(
      results.filter(
        (r) => named.includes(of(r)) && r.verdict.state === "broken",
      ),
    ).toEqual([]);
    // The one state a device cannot draw: below 760 px the nav is a drawer
    // with no edge to drag (`the-nav-fits-a-phone`), so `nav.wide` is not
    // drawn at a phone's width and the page says so by not reporting it.
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
