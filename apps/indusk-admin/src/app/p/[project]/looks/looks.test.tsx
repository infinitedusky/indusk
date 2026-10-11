// promise: a-mockup-is-approved-by-a-person
// promise: every-part-of-the-ui-is-covered
// promise: mockups-render-in-the-cockpit
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
import { NextRequest } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeRegistry } from "@/__tests__/helpers/next-dev";
import { POST as approveRoute } from "@/app/api/looks/[app]/approve/route";
import LooksPage from "./page";

/**
 * ui-promises A1 (the cockpit's half), A2, A13, A14, A29 (the route's half),
 * A30 (the route's half): the Looks page over the
 * package's looks fixture, read for real — a copy in a git repository on
 * `main`, registered in a temporary InDusk home — and Approve through its
 * route, which writes and commits the record there. Node, not the browser
 * project: the page and the route read and write files through the package,
 * which a browser cannot, and a mock of them would prove only the wiring.
 * The page is rendered to markup; the frame at a device's size is a browser's
 * to measure (A15, A16 — `looks-browser.contract.test.ts`, the system tier).
 *
 * The fixture (`apps/indusk-mcp/src/__tests__/fixtures/looks-app`):
 * `home.empty` approved, `home.full` proposed (its entry is for a stale
 * hash), `detail.default` drawn and never approved, `badge` rendered by the
 * app and shown by no mockup; devices `phone` and `desktop`.
 *
 * What the rows read:
 *   - a mockup:    `[data-testid="mockup-row"][data-mockup="<name>"]` with
 *                  `data-approval="approved|proposed"`
 *   - a device:    `a[data-testid="device-link"][data-device="<name>"]` inside it
 *   - uncovered:   `[data-testid="uncovered"]` holding one
 *                  `[data-testid="uncovered-item"][data-name="<name>"]` each
 */

const FIXTURE = resolve(
  __dirname,
  "../../../../../../indusk-mcp/src/__tests__/fixtures/looks-app",
);
const PROJECT = "looks-proj";
const RECORD = ".indusk/mockups/demo/approved.json";
const PERSON = "Sandy Tester";

let base: string;
let root: string;
let previousHome: string | undefined;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf-8" }).trim();
}

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), "admin-looks-")));
  root = join(base, "proj");
  const home = join(base, "home");
  mkdirSync(home, { recursive: true });
  cpSync(FIXTURE, root, { recursive: true });
  mkdirSync(join(root, ".indusk", "planning"), { recursive: true });
  git("init", "-q", "-b", "main");
  git("config", "user.name", PERSON);
  git("config", "user.email", "sandy@example.com");
  git("add", "-A");
  git("commit", "-qm", "the looks fixture");
  writeRegistry(home, [{ name: PROJECT, path: root }]);
  previousHome = process.env.INDUSK_HOME;
  process.env.INDUSK_HOME = home;
});

afterEach(() => {
  if (previousHome === undefined) delete process.env.INDUSK_HOME;
  else process.env.INDUSK_HOME = previousHome;
  rmSync(base, { recursive: true, force: true });
});

async function looksPage(query: Record<string, string> = {}): Promise<string> {
  const element = await LooksPage({
    params: Promise.resolve({ project: PROJECT }),
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element as React.ReactElement);
}

/** The opening tag of the element carrying `attr="value"`, and everything up to its row's end. */
function rowOf(html: string, mockup: string): string {
  const start = html.indexOf(`data-mockup="${mockup}"`);
  expect(start, `no row for ${mockup}`).toBeGreaterThan(-1);
  const open = html.lastIndexOf("<", start);
  const next = html.indexOf('data-testid="mockup-row"', start);
  return html.slice(open, next === -1 ? undefined : next);
}

function attrOf(tag: string, name: string): string | null {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
}

function sectionOf(html: string, testId: string): string {
  const start = html.indexOf(`data-testid="${testId}"`);
  expect(start, `no ${testId} section`).toBeGreaterThan(-1);
  const end = html.indexOf("</section>", start);
  return html.slice(start, end === -1 ? undefined : end);
}

const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

/**
 * A POST as the admin's page sends it: the browser sets `Origin` and the
 * fetch metadata (`Sec-Fetch-Site: same-origin`) itself, which page script
 * cannot. `fetchSite: null` leaves the header out, as `curl` does.
 */
function approveRequest(
  body: Record<string, unknown>,
  { fetchSite = "same-origin" }: { fetchSite?: string | null } = {},
): NextRequest {
  return new NextRequest("http://127.0.0.1:3996/api/looks/demo/approve", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3996",
      origin: "http://127.0.0.1:3996",
      "content-type": "application/json",
      ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}),
    },
    body: JSON.stringify(body),
  });
}

const demo = { params: Promise.resolve({ app: "demo" }) };
const foundationHash = () =>
  sha256(join(root, ".indusk/mockups/demo/foundation.tokens.json"));
/** The hash of a mockup as the page showed it — its bytes in `tree` (the project's own checkout by default). */
const mockupHash = (name: string, tree = root) =>
  sha256(join(tree, `.indusk/mockups/demo/screens/${name}.html`));
/** A group approval's body entry: each mockup with the hash the page showed. */
const shown = (name: string) => ({
  mockup: name,
  mockupHash: mockupHash(name),
});

describe("A1 — a mockup an agent drew reads proposed in the cockpit, and nothing is checked against it", () => {
  it("A1 home.full reads proposed; home.empty, approved, reads approved", async () => {
    const html = await looksPage();
    const full = rowOf(html, "home.full");
    expect(attrOf(full, "data-approval")).toBe("proposed");
    expect(full).toContain("proposed");
    expect(full, "a proposed mockup shows no check result").not.toMatch(
      /\b(held|broken)\b/,
    );
    expect(attrOf(rowOf(html, "home.empty"), "data-approval")).toBe("approved");
  });
});

describe("A2 — Approve in the cockpit makes a mockup the reference, recording who and when", () => {
  it("A2 approving home.full appends an entry bound to its hashes, by the person, committed on main; it then reads approved", async () => {
    const before = git("rev-parse", "main");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const entries = JSON.parse(readFileSync(join(root, RECORD), "utf-8"))
      .approvals as Array<Record<string, string>>;
    const entry = entries.at(-1);
    expect(entry).toMatchObject({
      mockup: "home.full",
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/home.full.html"),
      ),
      foundationHash: foundationHash(),
      by: PERSON,
    });
    expect(Date.parse(entry?.at ?? "")).not.toBeNaN();
    expect(git("rev-parse", "main")).not.toBe(before);
    expect(git("show", "--name-only", "--format=", "main")).toBe(RECORD);

    const html = await looksPage();
    const full = rowOf(html, "home.full");
    expect(attrOf(full, "data-approval")).toBe("approved");
    expect(full).toContain(PERSON);
  });

  it("A2 an approval of a foundation other than the one on main is refused, and the record is unchanged", async () => {
    const before = readFileSync(join(root, RECORD), "utf-8");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: "0".repeat(64),
      }),
      demo,
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /foundation/,
    );
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A2 — approval happens in the checkout the plan is worked in, never through main", () => {
  /** A plan worktree on `plan/looks` holding a mockup `main` does not, assigned to the plan. */
  function planWorktree(): string {
    const tree = join(base, "proj-plan");
    git("worktree", "add", "-q", "-b", "plan/looks", tree);
    const screens = ".indusk/mockups/demo/screens";
    cpSync(
      join(tree, screens, "detail.default.html"),
      join(tree, screens, "settings.default.html"),
    );
    execFileSync("git", ["add", "-A"], { cwd: tree });
    execFileSync("git", ["commit", "-qm", "a mockup only the plan holds"], {
      cwd: tree,
    });
    writeFileSync(
      join(root, ".git", "indusk-plan-worktrees.json"),
      `${JSON.stringify({
        version: 1,
        assignments: [
          {
            plan: "looks",
            path: tree,
            branch: "plan/looks",
            at: new Date().toISOString(),
          },
        ],
      })}\n`,
    );
    return tree;
  }

  it("A2 the page reads the plan's worktree when asked, and Approve commits on the plan's branch, leaving main as it was", async () => {
    const tree = planWorktree();
    const mainBefore = git("rev-parse", "main");

    expect(await looksPage()).not.toContain('data-mockup="settings.default"');
    const html = await looksPage({ checkout: "looks" });
    expect(attrOf(rowOf(html, "settings.default"), "data-approval")).toBe(
      "proposed",
    );
    expect(html).toContain('data-testid="looks-checkouts"');

    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "settings.default",
        mockupHash: mockupHash("settings.default", tree),
        foundationHash: sha256(
          join(tree, ".indusk/mockups/demo/foundation.tokens.json"),
        ),
        checkout: "looks",
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);

    const onBranch = execFileSync(
      "git",
      ["show", "--name-only", "--format=", "HEAD"],
      {
        cwd: tree,
        encoding: "utf-8",
      },
    ).trim();
    expect(onBranch).toBe(RECORD);
    expect(git("rev-parse", "main")).toBe(mainBefore);
    const after = await looksPage({ checkout: "looks" });
    expect(attrOf(rowOf(after, "settings.default"), "data-approval")).toBe(
      "approved",
    );
  });

  it("A2 a plan with no worktree holding mockups is refused, and so is a mockup the own checkout lacks", async () => {
    planWorktree();
    const hash = foundationHash();
    const unknown = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: mockupHash("home.full"),
        foundationHash: hash,
        checkout: "nope",
      }),
      demo,
    );
    expect(unknown.status).toBe(404);
    const missing = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "settings.default",
        mockupHash: "0".repeat(64),
        foundationHash: hash,
      }),
      demo,
    );
    expect(missing.status).toBe(409);
  });
});

describe("A2 — group approval records one entry per mockup, each as the person", () => {
  it("A2 only a proposed mockup has a checkbox; approving several records each bound to its own hash", async () => {
    const html = await looksPage();
    expect(rowOf(html, "home.full")).toContain("data-select-mockup");
    expect(rowOf(html, "detail.default")).toContain("data-select-mockup");
    expect(rowOf(html, "home.empty")).not.toContain("data-select-mockup");
    expect(html).toContain('data-testid="approve-selected"');

    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [shown("home.full"), shown("detail.default")],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const body = (await res.json()) as {
      results: Array<{ mockup: string; approved: boolean }>;
    };
    expect(body.results.map((r) => [r.mockup, r.approved])).toEqual([
      ["home.full", true],
      ["detail.default", true],
    ]);

    const entries = JSON.parse(readFileSync(join(root, RECORD), "utf-8"))
      .approvals as Array<Record<string, string>>;
    const mine = (name: string) =>
      entries.filter((e) => e.mockup === name).at(-1);
    expect(mine("home.full")).toMatchObject({
      by: PERSON,
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/home.full.html"),
      ),
    });
    expect(mine("detail.default")).toMatchObject({
      by: PERSON,
      mockupHash: sha256(
        join(root, ".indusk/mockups/demo/screens/detail.default.html"),
      ),
    });
    expect(git("log", "--format=%s", "-2")).toMatch(/approved by/);
  });

  it("A2 one refused mockup does not undo the others, and is named", async () => {
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockups: [
          shown("home.full"),
          { mockup: "nope", mockupHash: "0".repeat(64) },
        ],
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(200);
    const { results } = (await res.json()) as {
      results: Array<{ mockup: string; approved: boolean; reason?: string }>;
    };
    expect(results.find((r) => r.mockup === "home.full")?.approved).toBe(true);
    const refused = results.find((r) => r.mockup === "nope");
    expect(refused?.approved).toBe(false);
    expect(refused?.reason).toMatch(/no mockup/);
  });
});

describe("A29 — the approve route answers only a browser on the admin's own page", () => {
  it("A29 a POST that sets Host and Origin itself but carries no fetch metadata is refused, and nothing is written", async () => {
    const before = readFileSync(join(root, RECORD), "utf-8");
    const body = {
      project: PROJECT,
      mockup: "home.full",
      mockupHash: mockupHash("home.full"),
      foundationHash: foundationHash(),
    };
    for (const fetchSite of [null, "cross-site", "same-site", "none"]) {
      const res = await approveRoute(approveRequest(body, { fetchSite }), demo);
      expect(res.status, `Sec-Fetch-Site: ${fetchSite}`).toBe(403);
    }
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });
});

describe("A30 — an approval binds the mockup the person was shown", () => {
  it("A30 approving a mockup changed since the page showed it is refused, naming both hashes", async () => {
    const shownHash = mockupHash("home.full");
    const file = join(root, ".indusk/mockups/demo/screens/home.full.html");
    writeFileSync(
      file,
      `${readFileSync(file, "utf-8")}<!-- changed after the page read it -->\n`,
    );
    const before = readFileSync(join(root, RECORD), "utf-8");
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        mockupHash: shownHash,
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(409);
    const { error } = (await res.json()) as { error: string };
    expect(error).toContain(shownHash.slice(0, 8));
    expect(error).toContain(mockupHash("home.full").slice(0, 8));
    expect(readFileSync(join(root, RECORD), "utf-8")).toBe(before);
  });

  it("A30 an approval that names no mockup hash is refused", async () => {
    const res = await approveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.full",
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(400);
  });

  it("A30 the page carries each proposed mockup's hash beside its checkbox, for a group approval", async () => {
    const html = await looksPage();
    const box =
      rowOf(html, "home.full").match(
        /<input[^>]*data-select-mockup[^>]*>/,
      )?.[0] ?? "";
    expect(attrOf(box, "data-mockup-hash")).toBe(mockupHash("home.full"));
  });
});

describe("A13 — an uncovered part shows uncovered, never held", () => {
  it("A13 detail (drawn, never approved) and badge (rendered, in no mockup) are listed under Uncovered", async () => {
    const html = await looksPage();
    const uncovered = sectionOf(html, "uncovered");
    const names = [
      ...uncovered.matchAll(
        /data-testid="uncovered-item"[^>]*data-name="([^"]*)"/g,
      ),
    ].map((m) => m[1]);
    expect(names).toEqual(expect.arrayContaining(["detail", "badge"]));
    expect(uncovered, "nothing uncovered reads held").not.toMatch(/\bheld\b/);
    expect(attrOf(rowOf(html, "detail.default"), "data-approval")).toBe(
      "proposed",
    );
  });
});

describe("the Looks page says which of its states it drew, for the look check", () => {
  it("reports looks.uncovered while any part is uncovered", async () => {
    const html = await looksPage();
    const section = html.match(/<section[^>]*data-testid="looks"[^>]*>/)?.[0];
    expect(attrOf(section ?? "", "data-look-state")).toBe("looks.uncovered");
  });
});

describe("A14 — each mockup, proposed or approved, opens at the app's reference devices", () => {
  it("A14 every mockup row offers phone and desktop, each a link that opens it there", async () => {
    const html = await looksPage();
    for (const mockup of ["home.empty", "home.full", "detail.default"]) {
      const row = rowOf(html, mockup);
      const devices = [
        ...row.matchAll(/<a[^>]*data-testid="device-link"[^>]*>/g),
      ].map((m) => ({
        device: attrOf(m[0], "data-device"),
        href: attrOf(m[0], "href")?.replaceAll("&amp;", "&") ?? "",
      }));
      expect(devices.map((d) => d.device)).toEqual(["phone", "desktop"]);
      for (const d of devices) {
        expect(d.href).toContain(`mockup=${mockup}`);
        expect(d.href).toContain(`device=${d.device}`);
      }
    }
  });

  it("A14 opening a mockup at a device draws it in a frame of that device's size", async () => {
    const html = await looksPage({
      app: "demo",
      mockup: "home.full",
      device: "phone",
    });
    const frame = html.match(
      /<iframe[^>]*data-testid="mockup-frame"[^>]*>/,
    )?.[0];
    expect(frame).toBeDefined();
    expect(attrOf(frame ?? "", "width")).toBe("390");
    expect(attrOf(frame ?? "", "height")).toBe("844");
  });
});
