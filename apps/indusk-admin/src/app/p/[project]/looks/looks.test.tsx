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
 * ui-promises A1 (the cockpit's half), A2, A13, A14: the Looks page over the
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

function approveRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://127.0.0.1:3996/api/looks/demo/approve", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3996",
      origin: "http://127.0.0.1:3996",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const demo = { params: Promise.resolve({ app: "demo" }) };
const foundationHash = () =>
  sha256(join(root, ".indusk/mockups/demo/foundation.tokens.json"));

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
