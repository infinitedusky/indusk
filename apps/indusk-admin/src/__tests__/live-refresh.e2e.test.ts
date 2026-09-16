import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type DevServer, makeHome, startNextDev } from "./helpers/next-dev";

/**
 * admin-ui-phase-progress — A14, A15 (Test Phase 2).
 *
 * The only rows that need a browser against a running server: the page must
 * pick up a checkoff made on disk within one polling interval with no reload
 * (and keep the viewer's open collapsibles open), and it must show a "last
 * updated" time that advances — and say so, and stop, when a refresh fails.
 *
 * Authored RED in Test Phase 2 against the Build Phase 4 page, which never
 * refreshes itself; Build Phase 5 (`LiveRefresh`, `admin.refresh_ms`) turns
 * them green. Playwright drives a real `next dev` from the node project
 * (serialized like the HTTP smokes); the ADR (D10) names the fallback to a
 * manual procedure if this proves too slow or flaky, decided by measurement.
 */

const IMPL = `---
title: "Guinea pig"
status: in-progress
---

## Checklist

### Build Phase 1: Things

- [x] first thing
- [ ] second thing
- [ ] third thing

#### Build Phase 1 Verification
- [ ] T1 passes

#### Build Phase 1 Context
- [ ] a line

#### Build Phase 1 Document
- [ ] a page
`;

const REFRESH_MS = 1000;

let projectRoot = "";
let home = "";
let server: DevServer | null = null;
let browser: Browser | null = null;

beforeAll(async () => {
  projectRoot = mkdtempSync(join(tmpdir(), "live-refresh-project-"));
  mkdirSync(join(projectRoot, ".indusk", "planning", "guinea-pig"), {
    recursive: true,
  });
  writeFileSync(
    join(projectRoot, ".indusk", "config.json"),
    JSON.stringify({ admin: { refresh_ms: REFRESH_MS } }),
  );
  writeFileSync(
    join(projectRoot, ".indusk", "planning", "guinea-pig", "impl.md"),
    IMPL,
  );
  home = makeHome([{ name: "fixture", path: projectRoot }]);
  server = await startNextDev({ home });
  browser = await chromium.launch();
}, 90_000);

afterAll(async () => {
  await browser?.close();
  await server?.stop();
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function checkOffSecondThing(): void {
  const file = join(
    projectRoot,
    ".indusk",
    "planning",
    "guinea-pig",
    "impl.md",
  );
  writeFileSync(
    file,
    readFileSync(file, "utf-8").replace(
      "- [ ] second thing",
      "- [x] second thing",
    ),
  );
}

describe("A14 — a checkoff on disk reaches the open page within one interval, collapsibles preserved", () => {
  it("the stage bar goes from 1 of 3 to 2 of 3 with no reload, and an opened section stays open", async () => {
    if (!browser || !server) throw new Error("harness did not start");
    const page = await browser.newPage();
    await page.goto(`${server.url}/p/fixture/plan/guinea-pig`, {
      waitUntil: "networkidle",
    });
    const label = page.getByTestId("phase-bar-active-label");
    await label.filter({ hasText: /1 of 3/ }).waitFor({ timeout: 10_000 });

    // Open the Implementation Plan section — this must survive the refresh.
    const implPlan = page
      .locator('[data-testid="phases-section"] button[aria-expanded]')
      .first();
    await implPlan.click();
    expect(await implPlan.getAttribute("aria-expanded")).toBe("true");

    checkOffSecondThing();
    // One polling interval plus render time; a page that never refreshes
    // stays at 1 of 3 and this is where it goes red.
    await label
      .filter({ hasText: /2 of 3/ })
      .waitFor({ timeout: REFRESH_MS * 3 });
    expect(await implPlan.getAttribute("aria-expanded")).toBe("true");
    await page.close();
  }, 30_000);
});

describe("A15 — last updated advances, and a failed refresh is said out loud", () => {
  it("the time advances between two reads; after the server dies the page says refresh failed", async () => {
    if (!browser || !server) throw new Error("harness did not start");
    const page = await browser.newPage();
    await page.goto(`${server.url}/p/fixture/plan/guinea-pig`, {
      waitUntil: "networkidle",
    });
    const updated = page.getByTestId("last-updated");
    await updated.waitFor({ state: "visible", timeout: REFRESH_MS * 3 });
    const first = await updated.textContent();
    await page.waitForTimeout(REFRESH_MS * 1.5);
    const second = await updated.textContent();
    expect(second, "last-updated did not advance").not.toBe(first);

    await server.stop();
    await page
      .getByText(/refresh failed/i)
      .waitFor({ state: "visible", timeout: REFRESH_MS * 4 });
    await page.close();
  }, 30_000);
});
