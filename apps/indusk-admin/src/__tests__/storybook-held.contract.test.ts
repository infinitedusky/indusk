// promise: tokens-are-held-exactly — A19.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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
 * storybook-components A19 — the value check reaches stories: `indusk looks
 * check admin --url <the admin serving /storybook>` opens each approved story
 * in the served Storybook at each device and holds it to the foundation. A
 * contract with Next, Storybook and Chromium, so the system tier
 * (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait).
 *
 * The project is a git copy of the admin's own looks, its screens declared
 * away (the check opens only stories: a screen would need the admin's pages
 * for a project this test does not register) and every story approved through
 * the package's `approve`, as the cockpit's Approve does. One token changed in
 * the approved foundation, the stories re-approved on it, and the served
 * Storybook — built from the original — shows broken.
 */

const ADMIN = resolve(__dirname, "../..");
const REPO = resolve(ADMIN, "../..");
const CLI = join(REPO, "apps/indusk-mcp/dist/bin/cli.js");
const MOCKUPS = ".indusk/mockups/admin";

let base: string;
let project: string;
let server: DevServer;

const run = (cmd: string, args: string[], cwd: string) =>
  spawnSync(cmd, args, { cwd, encoding: "utf-8", timeout: 570_000 });

function git(...args: string[]) {
  const r = run("git", args, project);
  expect(r.status, r.stderr).toBe(0);
}

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-storybook-held-")));
  project = join(base, "proj");
  mkdirSync(join(project, ".indusk", "planning"), { recursive: true });
  writeFileSync(
    join(project, ".indusk", "config.json"),
    JSON.stringify({ mode: "full" }),
  );
  cpSync(join(REPO, MOCKUPS), join(project, MOCKUPS), { recursive: true });
  rmSync(join(project, MOCKUPS, "approved.json"));
  rmSync(join(project, MOCKUPS, "screens"), { recursive: true, force: true });
  const screens = JSON.parse(
    readFileSync(join(project, MOCKUPS, "screens.json"), "utf-8"),
  );
  screens.screens = [];
  screens.uncomposed = [];
  screens.sources = [];
  writeFileSync(
    join(project, MOCKUPS, "screens.json"),
    JSON.stringify(screens, null, "\t"),
  );
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Story Tester");
  git("config", "user.email", "story@example.com");
  git("add", "-A");
  git("commit", "-qm", "the admin's stories");

  if (!existsSync(join(ADMIN, "public/storybook/iframe.html"))) {
    const built = run("pnpm", ["run", "build:storybook"], ADMIN);
    expect(built.status, built.stderr).toBe(0);
  }
  server = await startNextDev({ home: makeHome([]) });
}, 400_000);

afterAll(async () => {
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

/** Approve every story as the cockpit does: through the package, with what the page showed. */
async function approveEveryStory() {
  const { readApp } = await import("@infinitedusky/indusk-mcp/looks/mockups");
  const { approve } = await import("@infinitedusky/indusk-mcp/looks/approve");
  const app = await readApp(project, "admin");
  expect(app.stories.length, "the admin has stories").toBeGreaterThan(0);
  for (const story of app.stories) {
    const r = await approve(project, "admin", story.name, "Story Tester", {
      kind: "story",
      snapshotHash: story.hash,
      stylesheetHash: story.stylesheetHash ?? undefined,
      foundationHash: app.foundation.hash,
    });
    expect(r.approved, JSON.stringify(r)).toBe(true);
  }
}

const check = () =>
  run("node", [CLI, "looks", "check", "admin", "--url", server.url], project);

describe("A19 — a story is held to the approved foundation", () => {
  it("A19 every approved story reads held; one token changed shows the story broken", async () => {
    await approveEveryStory();
    const held = check();
    expect(held.status, `${held.stdout}\n${held.stderr}`).toBe(0);
    expect(held.stdout).toMatch(/^held\s+story chip\.passing @ phone/m);
    expect(held.stdout).not.toMatch(/^broken/m);

    // One colour token changed in the approved foundation, stories approved
    // on it again: the served Storybook still draws the old value.
    const file = join(project, MOCKUPS, "foundation.tokens.json");
    const foundation = JSON.parse(readFileSync(file, "utf-8"));
    const name = Object.keys(foundation.color).find(
      (k) => !k.startsWith("$"),
    ) as string;
    const token = foundation.color[name];
    token.$value = {
      colorSpace: "srgb",
      components: [0, 0.5, 1],
      hex: "#0080ff",
    };
    writeFileSync(file, `${JSON.stringify(foundation, null, "\t")}\n`);
    git("add", "-A");
    git("commit", "-qm", "one token changed");
    await approveEveryStory();

    const broken = check();
    expect(broken.status, "one changed token exits non-zero").toBe(1);
    expect(broken.stdout).toMatch(/^broken\s+story \S+ @ phone/m);
    expect(broken.stdout).toMatch(/token --color-\S+ approved \S+ actual \S+/);
  }, 580_000);
});
