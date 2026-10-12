// promise: a-mockup-is-approved-by-a-person — the Unapprove route answers a person's browser, binds what they were shown, and writes only a withdrawal.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readAppLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  approveRequest,
  attrOf,
  demo,
  foundationHash,
  git,
  looksPage,
  PROJECT,
  RECORD,
  root,
  rowOf,
  setUpComponentsProject,
  sha256,
  tearDownProject,
} from "@/__tests__/helpers/looks-page";
import { POST as unapproveRoute } from "@/app/api/looks/[app]/unapprove/route";

/**
 * ADR decision 11, the route's half (A29 is the page's): Unapprove records a
 * withdrawal as the person this machine's git names, bound to the hashes the
 * page showed, committing only the record; a stale hash, a look that is not
 * approved, or a request with no browser metadata writes nothing.
 */

beforeEach(setUpComponentsProject);
afterEach(tearDownProject);

const record = () => readFileSync(join(root, RECORD), "utf-8");
const snapshot = (name: string) =>
  join(root, `.indusk/mockups/demo/components/${name}.html`);

async function hashes(mockup: string) {
  const looks = await readAppLooks(root, "demo");
  if ("problem" in looks) throw new Error(looks.problem);
  const m = looks.mockups.find((x) => x.name === mockup);
  if (!m) throw new Error(`no mockup ${mockup}`);
  return { mockupHash: m.hash, componentsHash: m.componentsHash };
}

describe("the Unapprove route", () => {
  it("records a story's withdrawal as the person git names, and the page then reads it proposed", async () => {
    const res = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        kind: "story",
        story: "badge.ok",
        snapshotHash: sha256(snapshot("badge.ok")),
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    const held = JSON.parse(record()).approvals;
    expect(held.at(-1)).toMatchObject({
      kind: "withdrawn",
      subject: "story",
      name: "badge.ok",
      by: "Sandy Tester",
    });
    expect(held.length, "the record keeps every entry it had").toBe(5);
    expect(
      git("show", "--name-only", "--format=", "HEAD").split("\n"),
      "only the record is committed",
    ).toEqual([RECORD]);
    const html = await looksPage({ show: "components" });
    const at = html.indexOf('data-story="badge.ok"');
    const row = html.slice(html.lastIndexOf("<", at), html.indexOf(">", at));
    expect(attrOf(row, "data-approval")).toBe("proposed");
  });

  it("records a mockup's withdrawal bound to the hashes it was shown at", async () => {
    const res = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.default",
        ...(await hashes("home.default")),
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status, await res.clone().text()).toBe(200);
    expect(JSON.parse(record()).approvals.at(-1)).toMatchObject({
      kind: "withdrawn",
      subject: "mockup",
      name: "home.default",
    });
    const html = await looksPage({ show: "mockups" });
    expect(attrOf(rowOf(html, "home.default"), "data-approval")).toBe(
      "proposed",
    );
    expect(attrOf(rowOf(html, "detail.default"), "data-approval")).toBe(
      "approved",
    );
  });

  it("refuses what the page did not show: a changed snapshot, a missing hash", async () => {
    const shown = sha256(snapshot("badge.ok"));
    const file = snapshot("badge.ok");
    writeFileSync(file, `${readFileSync(file, "utf-8")}<!-- changed -->\n`);
    const before = record();
    const stale = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        kind: "story",
        story: "badge.ok",
        snapshotHash: shown,
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(stale.status).toBe(409);
    const missing = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        kind: "story",
        story: "badge.ok",
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(missing.status).toBe(400);
    const noHash = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        mockup: "home.default",
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(noHash.status).toBe(400);
    expect(record(), "a refusal writes nothing").toBe(before);
  });

  it("refuses a look that is not approved, naming that there is nothing to take back", async () => {
    const before = record();
    const res = await unapproveRoute(
      approveRequest({
        project: PROJECT,
        kind: "story",
        story: "badge.broken",
        snapshotHash: sha256(snapshot("badge.broken")),
        foundationHash: foundationHash(),
      }),
      demo,
    );
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /not approved/,
    );
    expect(record()).toBe(before);
  });

  it("answers only a browser on the admin's own page: no fetch metadata is refused", async () => {
    const before = record();
    for (const fetchSite of [null, "cross-site", "same-site", "none"]) {
      const res = await unapproveRoute(
        approveRequest(
          {
            project: PROJECT,
            kind: "story",
            story: "badge.ok",
            snapshotHash: sha256(snapshot("badge.ok")),
            foundationHash: foundationHash(),
          },
          { fetchSite },
        ),
        demo,
      );
      expect(res.status, `Sec-Fetch-Site: ${fetchSite}`).toBe(403);
    }
    expect(record()).toBe(before);
  });
});
