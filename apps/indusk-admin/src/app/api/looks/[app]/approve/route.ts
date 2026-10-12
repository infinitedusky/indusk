import {
  approve,
  approver,
  type Seen,
} from "@infinitedusky/indusk-mcp/looks/approvals";
import { looksCheckouts } from "@infinitedusky/indusk-mcp/looks/overview";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a mockup (ui-promises ADR decision 3): `{ project, mockup,
 * mockupHash, componentsHash?, foundationHash, checkout }`, or a group's
 * `mockups: [{ mockup, mockupHash, componentsHash? }]`; or a story
 * (storybook-components ADR decision 5): `{ project, kind: "story", story,
 * snapshotHash, foundationHash, checkout }`. The package's `approve` records it as the
 * person this machine's git names, bound to the mockup's and the foundation's
 * hashes as the checkout holds them, and commits the record on that checkout's
 * branch. `checkout` is the plan whose worktree the page showed, or null for
 * the project's own checkout; it is resolved from the plan-worktree record,
 * never taken as a path. `foundationHash` is the foundation the page showed: a
 * foundation is approved only with a mockup, so an approval of one the person
 * did not see is refused, as is a mockup the checkout does not hold.
 * `mockupHash` is the mockup the page showed, each one in a group: a mockup
 * changed since is refused naming both hashes, and one sent without its hash
 * is refused outright — an approval binds what the person looked at.
 * `componentsHash` is the snapshots the mockup composed as the page showed
 * them, `snapshotHash` the story's snapshot: each refused when the checkout
 * now holds another, and a story sent without its hash is refused outright.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
/**
 * What this route adds to `adminOnly`, which a local process passes by
 * setting `Host` and `Origin` itself: the browser's own fetch metadata. A
 * browser sets `Sec-Fetch-Site` on every request and page script cannot set
 * or change it, so `same-origin` says the person's browser sent this from the
 * admin's page. `curl`, an agent's script or a test harness sends none.
 * Raises the bar to a deliberate forgery; it is not a signature
 * (ui-promises Build Phase 6, A29).
 */
function fromTheBrowser(request: NextRequest): Response | null {
  if (request.headers.get("sec-fetch-site") === "same-origin") return null;
  return refuse(
    403,
    "a mockup is approved only by a person, with Approve on the cockpit's Looks page in their browser",
  );
}

interface Shown {
  mockup: string;
  mockupHash: string;
  componentsHash?: string;
}

/** One thing the page showed, as `approve` takes it: its name and what was seen. */
interface Request {
  name: string;
  seen: Seen;
}

const isShown = (m: unknown): m is Shown =>
  typeof m === "object" &&
  m !== null &&
  typeof (m as Shown).mockup === "string" &&
  (m as Shown).mockup !== "" &&
  typeof (m as Shown).mockupHash === "string" &&
  (m as Shown).mockupHash !== "";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> },
): Promise<Response> {
  const refused =
    adminOnly(request, "a mockup is approved only from the admin's own page") ??
    fromTheBrowser(request);
  if (refused) return refused;
  const { app } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    mockup?: string;
    /** The hash of the mockup the page showed (A30). */
    mockupHash?: string;
    /** The snapshots the mockup composed, as the page showed them. */
    componentsHash?: string;
    /** A group approval: each mockup with the hash the page showed, approved on its own, in order. */
    mockups?: Array<{
      mockup?: string;
      mockupHash?: string;
      componentsHash?: string;
    }>;
    /** `story`: a component's story, approved by the snapshot hash the page showed. */
    kind?: string;
    story?: string;
    snapshotHash?: string;
    foundationHash?: string;
    checkout?: string | null;
  } | null;
  const isStory = body?.kind === "story";
  const shown = isStory
    ? []
    : Array.isArray(body?.mockups)
      ? body.mockups
      : body?.mockup
        ? [
            {
              mockup: body.mockup,
              mockupHash: body.mockupHash,
              componentsHash: body.componentsHash,
            },
          ]
        : [];
  if (
    !body?.project ||
    !body.foundationHash ||
    (isStory
      ? !body.story || !body.snapshotHash
      : shown.length === 0 || shown.some((m) => !isShown(m)))
  )
    return refuse(
      400,
      isStory
        ? "a story's approval needs the project, the story, the snapshot hash it was shown at, and the foundation it was shown on"
        : "an approval needs the project, each mockup with the hash it was shown at, and the foundation it was shown on",
    );
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const checkout = (await looksCheckouts(root)).find(
    (c) => c.plan === (body.checkout ?? null),
  );
  if (!checkout)
    return refuse(
      404,
      `plan ${JSON.stringify(body.checkout)} has no worktree here that holds mockups`,
    );
  const by = await approver(root);
  const requests: Request[] = isStory
    ? [
        {
          name: body.story as string,
          seen: {
            kind: "story",
            snapshotHash: body.snapshotHash as string,
            foundationHash: body.foundationHash,
          },
        },
      ]
    : (shown as Shown[]).map((m) => ({
        name: m.mockup,
        seen: {
          foundationHash: body.foundationHash,
          mockupHash: m.mockupHash,
          ...(m.componentsHash ? { componentsHash: m.componentsHash } : {}),
        },
      }));
  const results = [];
  for (const { name, seen } of requests) {
    results.push({
      mockup: name,
      ...(await approve(checkout.root, app, name, by, seen)),
    });
  }
  if (!body.mockups) {
    const [only] = results;
    if (!only?.approved) return refuse(409, only?.reason ?? "refused");
    return Response.json({ entry: only.entry, commit: only.commit });
  }
  // A group approval answers for each mockup: one refused does not undo the
  // ones recorded, and the page says which.
  return Response.json(
    { results },
    { status: results.some((r) => r.approved) ? 200 : 409 },
  );
}
