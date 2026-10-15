// promise: a-plan-page-shows-the-parts-of-its-brief
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type DevServer,
  makeHome,
  startNextDev,
} from "@/__tests__/helpers/next-dev";

/**
 * brief-as-the-contract A16 — a contract with Next and Chromium, so the system
 * tier (`vitest.tiers.ts` `SYSTEM`; lesson: everyday-tests-never-wait): the
 * plan's page served by `next dev`, open in a real browser, while the agent's
 * files change under it. A look the brief names and the agent draws appears on
 * the page, proposed, without a reload, and its frame is drawn at each
 * reference device's width. What the page lists is `plan-parts.test.tsx`'s.
 */

const FIXTURE = resolve(
  __dirname,
  "../../../indusk-mcp/src/__tests__/fixtures/looks-app",
);
const PROJECT = "plan-parts-browser";
const PLAN = "brief-as-the-contract";
const DEVICES = [
  { name: "phone", width: 390 },
  { name: "desktop", width: 1440 },
];

const brief = (looks: string) => `---
title: "Brief as the contract"
status: accepted
workflow: feature
---

# Brief as the contract

## Expectations

None — nothing to look at yet.

## Promises

### This plan makes

1. **\`a-plan-page-shows-the-parts-of-its-brief\`** (state). A plan's page shows its promises, expectations and looks.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

## Looks

${looks}
`;

const LOOKS = `### This plan makes

1. **\`plan.working\`**. The plan page while it is built.

### Existing looks

**Must not break**

None.

**Changes**

None.

**Replaces**

None.`;

const NO_LOOKS = "None — nothing drawn yet.";

const MOCKUP = `<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="../tokens.css"></head>
<body><p style="color: var(--color-ink)">working</p></body></html>
`;

let base: string;
let root: string;
let server: DevServer;
let browser: Browser;

beforeAll(async () => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-plan-parts-")));
  root = join(base, "proj");
  cpSync(FIXTURE, root, { recursive: true });
  mkdirSync(join(root, ".indusk", "planning", PLAN), { recursive: true });
  writeFileSync(
    join(root, ".indusk", "config.json"),
    JSON.stringify({ mode: "full", admin: { refresh_ms: 1000 } }),
  );
  writeFileSync(
    join(root, ".indusk", "planning", PLAN, "brief.md"),
    brief(NO_LOOKS),
  );
  writeFileSync(
    join(root, ".indusk", "planning", PLAN, "impl.md"),
    "---\nstatus: in-progress\n---\n# impl\n",
  );
  server = await startNextDev({
    home: makeHome([{ name: PROJECT, path: root }]),
  });
  browser = await chromium.launch();
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  rmSync(base, { recursive: true, force: true });
});

/** What the agent does: draws the mockup and lists it in the brief. */
function writeMockup(name: string, html: string) {
  const demo = join(root, ".indusk", "mockups", "demo");
  writeFileSync(join(demo, "screens", `${name}.html`), html);
  const screens = JSON.parse(readFileSync(join(demo, "screens.json"), "utf-8"));
  screens.screens.push({ name: "plan", states: ["working"] });
  writeFileSync(join(demo, "screens.json"), JSON.stringify(screens, null, 2));
  writeFileSync(
    join(root, ".indusk", "planning", PLAN, "brief.md"),
    brief(LOOKS),
  );
}

async function open(page: Page, path: string) {
  await page.goto(`${server.url}${path}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
}

async function expectFrameWidth(
  page: Page,
  look: string,
  device: string,
  width: number,
) {
  await page
    .locator(
      `[data-testid="plan-look"][data-look="${look}"] [data-device="${device}"]`,
    )
    .click();
  const frame = page.locator(`[data-testid="plan-look-frame-${look}"]`);
  await expect.poll(async () => (await frame.boundingBox())?.width).toBe(width);
}

describe("A16 — a look drawn while the page is open appears there", () => {
  it("A16 a look drawn while the page is open appears there at each device", async () => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 1000 },
    });
    try {
      await open(page, `/p/${PROJECT}/plan/${PLAN}`);
      const looks = page.locator('[data-part="looks"]');
      await looks.waitFor({ timeout: 30_000 });
      // Every part but the status is collapsed by default (Sandy, 2026-10-13):
      // the person opens Looks once, and what the agent draws appears there.
      await looks.locator("summary").click();
      writeMockup("plan.working", MOCKUP);
      const row = page.locator(
        '[data-testid="plan-look"][data-look="plan.working"]',
      );
      await row.waitFor({ state: "visible", timeout: 15_000 });
      expect(await row.getAttribute("data-approval")).toBe("proposed");
      await row.getByRole("button", { name: "Open" }).click();
      for (const { name, width } of DEVICES) {
        await expectFrameWidth(page, "plan.working", name, width);
      }
    } finally {
      await page.close();
    }
  }, 120_000);
});
