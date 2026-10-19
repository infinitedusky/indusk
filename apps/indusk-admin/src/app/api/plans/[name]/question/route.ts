import { appendDecision } from "@infinitedusky/indusk-mcp/plans/history";
import {
  answerQuestionRecord,
  readQuestions,
} from "@infinitedusky/indusk-mcp/questions";
import type { NextRequest } from "next/server";
import { resumeAfterQuestion } from "@/lib/build-host";
import { answerOneQuestion } from "@/lib/question-answer";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer one question of a plan (decisions-as-questions, ADR decision 7):
 * `{ project, id, text }`. The question's own state decides where the answer goes
 * (`lib/question-answer`); an empty reply and an answered question are refused.
 *
 * promise: decisions-wait-in-one-place
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a question is answered only from the admin's own page",
  );
  if (refused) return refused;
  const { name } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    id?: string;
    text?: string;
  } | null;
  if (!body?.project || !body.id || typeof body.text !== "string") {
    return refuse(400, "an answer needs project, id and text");
  }
  const { project, id, text } = body;
  const root = getProjectPath(project);
  if (!root) return refuse(404, `no project named ${project}`);
  try {
    const answered = await answerOneQuestion(
      {
        find: (qid) => readQuestions(root, name).find((q) => q.id === qid),
        record: (qid, words) => answerQuestionRecord(root, name, qid, words),
        tellSession: (sessionId, requestId, words, question) =>
          sessionManager().reply(
            sessionId,
            { requestId, answers: { [question]: words } },
            "person",
          ),
        resume: () => resumeAfterQuestion(project, name),
        decision: (entry) => appendDecision(root, name, entry),
      },
      id,
      text,
    );
    return Response.json(answered);
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
