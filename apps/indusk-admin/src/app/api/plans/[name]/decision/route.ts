import { approvePlan } from "@infinitedusky/indusk-mcp/plans";
import { appendDecision } from "@infinitedusky/indusk-mcp/plans/history";
import {
  WAITING_KINDS,
  type WaitingOn,
} from "@infinitedusky/indusk-mcp/plans/waiting";
import {
  answerQuestionRecord,
  readQuestions,
} from "@infinitedusky/indusk-mcp/questions";
import type { NextRequest } from "next/server";
import { resumeAfterQuestion, startRelease } from "@/lib/build-host";
import { answerDecision, type DecisionChoice } from "@/lib/decisions";
import { readWaiting } from "@/lib/decisions-reader";
import { readActivePlans } from "@/lib/planning-reader";
import { getProjectPath } from "@/lib/registry-client";
import {
  adminOnly,
  planLocation,
  refuse,
  sessionManager,
} from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer the decision a plan waits on (plan-cockpit, ADR decision 4):
 * `{ project, choice: "accept" | "alternative" | "reply" | "answers", on?, text?, answers? }`.
 * `on` is the kind of decision the card showed; an answer to one the plan no
 * longer waits on is refused. What the
 * plan waits on is read again here, never taken from the page, so an answer
 * meant for a question already answered, or a review already accepted, is
 * refused rather than sent somewhere else. The answer goes where
 * `lib/decisions` routes it and is recorded in the plan's history on `main`;
 * the response says whether that record was committed, and why not.
 *
 * promise: decisions-wait-in-one-place
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a decision is answered only from the admin's own page",
  );
  if (refused) return refused;
  const { name } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    choice?: string;
    on?: string;
    text?: string;
    answers?: unknown;
  } | null;
  const choice = choiceOf(body);
  if (!body?.project || !choice) {
    return refuse(
      400,
      "a decision needs project and choice accept, alternative, or reply with text",
    );
  }
  const { project } = body;
  if (
    body.on !== undefined &&
    !(WAITING_KINDS as readonly string[]).includes(body.on)
  ) {
    return refuse(400, `on is one of ${WAITING_KINDS.join(", ")}`);
  }
  const root = getProjectPath(project);
  if (!root) return refuse(404, `no project named ${project}`);
  const plan = (await readActivePlans(root)).find((p) => p.name === name);
  if (!plan) return refuse(404, `${project} has no active plan named ${name}`);
  const waiting = (await readWaiting(project, root, [plan]))[0];
  if (!waiting) return refuse(409, `${name} is not waiting on a decision`);
  try {
    const answered = await answerDecision(
      {
        sessions: sessionManager(),
        where: () => planLocation(project, name),
        approve: () => approvePlan(root, name),
        release: () => startRelease(project, name),
        record: (entry) => appendDecision(root, name, entry),
        questions: {
          answer: (id, text) => {
            answerQuestionRecord(root, name, id, text);
          },
          resume: () => resumeAfterQuestion(project, name),
          byRequest: (requestId) =>
            readQuestions(root, name).find(
              (q) => q.session?.requestId === requestId,
            )?.id,
        },
      },
      project,
      waiting,
      choice,
      body.on as WaitingOn | undefined,
    );
    return Response.json(answered);
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}

function choiceOf(
  body: { choice?: string; text?: string; answers?: unknown } | null,
): DecisionChoice | null {
  if (body?.choice === "answers") {
    const given = body.answers;
    if (!given || typeof given !== "object") return null;
    const entries = Object.entries(given);
    if (entries.some(([, v]) => typeof v !== "string")) return null;
    return {
      choice: "answers",
      answers: Object.fromEntries(entries) as Record<string, string>,
    };
  }
  if (body?.choice === "accept" || body?.choice === "alternative")
    return { choice: body.choice };
  if (body?.choice === "reply" && typeof body.text === "string")
    return { choice: "reply", text: body.text };
  return null;
}
