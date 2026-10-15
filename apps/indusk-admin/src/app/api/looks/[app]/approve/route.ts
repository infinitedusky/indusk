import {
  approve,
  approver,
  componentsHashesMissing,
  type Seen,
} from "@infinitedusky/indusk-mcp/looks/approve";
import type { NextRequest } from "next/server";
import { refuse } from "@/lib/session-host";
import { type LooksBody, readLooksRequest } from "../request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a mockup (ui-promises ADR decision 3): `{ project, mockup,
 * mockupHash, componentsHash?, foundationHash, checkout }`, or a group's
 * `mockups: [{ mockup, mockupHash, componentsHash? }]`; or a story
 * (storybook-components ADR decision 5): `{ project, kind: "story", story,
 * snapshotHash, stylesheetHash?, foundationHash, checkout }`. The package's `approve` records it as the
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
 * them, `snapshotHash` the story's snapshot and `stylesheetHash` its
 * component's stylesheet: each refused when the checkout now holds another,
 * and a story sent without its snapshot hash is refused outright.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
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

/** The request body: what the page showed the person, and where. */
interface ApproveBody extends LooksBody {
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
  /** A group of stories, each with the snapshot hash the page showed, approved on its own, in order. */
  stories?: Array<{
    story?: string;
    snapshotHash?: string;
    stylesheetHash?: string;
  }>;
  /** `story`: a component's story, approved by the snapshot hash the page showed. */
  kind?: string;
  story?: string;
  snapshotHash?: string;
  /** The story's component's stylesheet as the page showed it; absent when it has none. */
  stylesheetHash?: string;
  foundationHash?: string;
}

/**
 * What the page showed, as the list `approve` is called with, or null when
 * the body does not name everything an approval binds: the foundation, and
 * for each mockup the hash it was shown at (a story: its snapshot's).
 */
function requestsOf(body: ApproveBody): Request[] | null {
  const { foundationHash } = body;
  if (!foundationHash) return null;
  if (body.kind === "story") {
    if (!body.story || !body.snapshotHash) return null;
    return [
      {
        name: body.story,
        seen: {
          kind: "story",
          snapshotHash: body.snapshotHash,
          ...(body.stylesheetHash
            ? { stylesheetHash: body.stylesheetHash }
            : {}),
          foundationHash,
        },
      },
    ];
  }
  const stories = Array.isArray(body.stories) ? body.stories : [];
  const storyRequests: Request[] = [];
  for (const s of stories) {
    if (!s.story || !s.snapshotHash) return null;
    storyRequests.push({
      name: s.story,
      seen: {
        kind: "story",
        snapshotHash: s.snapshotHash,
        ...(s.stylesheetHash ? { stylesheetHash: s.stylesheetHash } : {}),
        foundationHash,
      },
    });
  }
  const shown = Array.isArray(body.mockups)
    ? body.mockups
    : body.mockup
      ? [
          {
            mockup: body.mockup,
            mockupHash: body.mockupHash,
            componentsHash: body.componentsHash,
          },
        ]
      : [];
  // A group may be stories alone, mockups alone, or both: one request.
  if (shown.length === 0)
    return storyRequests.length > 0 ? storyRequests : null;
  if (!shown.every(isShown)) return null;
  const mockupRequests: Request[] = shown.map((m) => ({
    name: m.mockup,
    seen: {
      foundationHash,
      mockupHash: m.mockupHash,
      ...(m.componentsHash ? { componentsHash: m.componentsHash } : {}),
    },
  }));
  // Stories first: a mockup is approved only once each story it composes is,
  // so a group holding both records the stories and then the mockups (A33).
  return [...storyRequests, ...mockupRequests];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> },
): Promise<Response> {
  const read = await readLooksRequest<ApproveBody, Request[]>(request, params, {
    adminMessage: "a mockup is approved only from the admin's own page",
    browserMessage:
      "a mockup is approved only by a person, with Approve on the cockpit's Looks page in their browser",
    subjectOf: requestsOf,
    incomplete: (body) =>
      body?.kind === "story"
        ? "a story's approval needs the project, the story, the snapshot hash it was shown at, and the foundation it was shown on"
        : "an approval needs the project, each mockup with the hash it was shown at, and the foundation it was shown on",
  });
  if (read instanceof Response) return read;
  const { app, body, root, checkout, subject: requests } = read;
  const incomplete = await componentsHashesMissing(
    checkout.root,
    app,
    requests,
  );
  if (incomplete) return refuse(400, incomplete);
  const by = await approver(root);
  const results = [];
  for (const { name, seen } of requests) {
    results.push({
      mockup: name,
      ...(await approve(checkout.root, app, name, by, seen)),
    });
  }
  if (!body.mockups && !body.stories) {
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
