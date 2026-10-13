import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// promise: a-change-to-what-was-agreed-needs-the-person
// promise: only-a-person-reapproves

/**
 * brief-as-the-contract A13: an amendment is approved only by a person in
 * their browser. The route answers the cockpit's Approve on a waiting
 * amendment by calling the package's `reapprovePlan`; a request that sets
 * `Host` and `Origin` itself but carries no browser fetch metadata — a script,
 * an agent's `curl` — is refused before anything is called. The guards are
 * the real ones (`adminOnly`, then `fromTheBrowser`); the registry and the
 * package's reapproval are stood in for, the plan holding one amendment that
 * waits, so what is asserted is who may ask, and that the package is what
 * answers.
 */

const PROJECT = "seat-holds-app";
const PROJECT_PATH = "/mock/seat-holds-app";
const PLAN = "seat-holds";

const reapproved: Array<{ root: string; plan: string }> = [];

vi.mock("@/lib/registry-client", () => ({
  getProjectPath: (name: string) => (name === PROJECT ? PROJECT_PATH : null),
}));
vi.mock("@infinitedusky/indusk-mcp/plans", () => ({
  PlanCommandRefusal: class PlanCommandRefusal extends Error {},
  reapprovePlan: async (root: string, plan: string) => {
    reapproved.push({ root, plan });
    return {
      plan,
      approvedBrief: "b".repeat(64),
      amendments: [
        {
          part: "promise",
          name: "seat-released-on-timeout",
          was: "A held seat is released when its hold runs out.",
          now: "A held seat is released at once when its hold runs out.",
        },
      ],
    };
  },
}));

import { POST } from "@/app/api/plans/[name]/reapprove/route";

const request = ({ fetchSite }: { fetchSite: string | null }) =>
  new NextRequest(`http://127.0.0.1:3996/api/plans/${PLAN}/reapprove`, {
    method: "POST",
    headers: {
      host: "127.0.0.1:3996",
      origin: "http://127.0.0.1:3996",
      "content-type": "application/json",
      ...(fetchSite ? { "sec-fetch-site": fetchSite } : {}),
    },
    body: JSON.stringify({ project: PROJECT }),
  });

const reapprove = (req: NextRequest) =>
  POST(req, { params: Promise.resolve({ name: PLAN }) });

beforeEach(() => {
  reapproved.length = 0;
});

describe("A13 — an amendment is approved only from the person's browser", () => {
  it("A13 an amendment is approved only from the person's browser", async () => {
    for (const fetchSite of [null, "cross-site", "same-site", "none"]) {
      const script = await reapprove(request({ fetchSite }));
      expect(script.status, `Sec-Fetch-Site: ${fetchSite}`).toBe(403);
    }
    expect(reapproved).toEqual([]);

    const browser = await reapprove(request({ fetchSite: "same-origin" }));
    expect(browser.status).toBe(200);
    expect(reapproved).toEqual([{ root: PROJECT_PATH, plan: PLAN }]);
    const body = (await browser.json()) as {
      amendments: Array<{ name: string; now: string }>;
    };
    expect(body.amendments.map((a) => a.name)).toEqual([
      "seat-released-on-timeout",
    ]);
  });
});
