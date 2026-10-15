// promise: decisions-wait-in-one-place

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DecisionEntry } from "@infinitedusky/indusk-mcp/plans/history";
import {
  AMENDMENT_DECISION,
  type Waiting,
} from "@infinitedusky/indusk-mcp/plans/waiting";
import {
  type QuestionEvent,
  type Session,
  SessionManager,
  type SessionOptions,
} from "@infinitedusky/indusk-mcp/session";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { answerDecision, type DecisionDeps } from "./decisions";

/**
 * plan-cockpit A15 and A16: an answer chosen on the decision card reaches the
 * plan's running agent — as the answer to its question, through the session
 * manager the session panel uses — and a reply in words reaches the plan's
 * agent whether or not a session runs for it: said to the running one, or a
 * new session started for the plan in its worktree with the decision and the
 * words as its prompt. Every answer is recorded.
 *
 * The manager is the package's real one; only the `claude` it would launch is
 * a fake, so `answer` and `say` are what the session's stdin would get.
 */

const PROJECT = "seats";
const PLAN = "seat-holds";
const WORKTREE = "/work/seats-worktrees/seat-holds";

let dir: string;
let launched: SessionOptions[];
let fake: {
  answer: Mock<Session["answer"]>;
  say: Mock<Session["say"]>;
  decide: Mock<Session["decide"]>;
};
let manager: SessionManager;
let recorded: DecisionEntry[];

function fakeSession(opts: SessionOptions): Session {
  launched.push(opts);
  return {
    pid: 99999999,
    kind: opts.kind,
    cwd: opts.cwd,
    say: fake.say,
    answer: fake.answer,
    decide: fake.decide,
    stop: async () => {},
    done: new Promise(() => {}),
  };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "decisions-"));
  launched = [];
  recorded = [];
  fake = {
    answer: vi.fn<Session["answer"]>(),
    say: vi.fn<Session["say"]>(),
    decide: vi.fn<Session["decide"]>(),
  };
  manager = new SessionManager({
    recordPath: join(dir, "admin-sessions.json"),
    start: fakeSession,
  });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function deps(over: Partial<DecisionDeps> = {}): DecisionDeps {
  return {
    sessions: manager,
    where: async () => ({ cwd: WORKTREE }),
    approve: vi.fn(async () => ({})),
    release: vi.fn(async () => ({})),
    record: (entry) => {
      recorded.push(entry);
      return { commit: { committed: true } };
    },
    now: () => new Date("2026-10-10T10:00:00.000Z"),
    ...over,
  };
}

const QUESTION = "Which seat map should holds use?";

/** A planning session for the plan, which has asked its question. */
function askingSession(): { id: string; ev: QuestionEvent } {
  const { id } = manager.start({
    project: PROJECT,
    plan: PLAN,
    cwd: WORKTREE,
    kind: "planning",
    prompt: `/planner ${PLAN}`,
    onEvent: () => {},
  });
  const emit = launched[0]?.onEvent as SessionOptions["onEvent"];
  const ev: QuestionEvent = {
    type: "question",
    requestId: "req-1",
    questions: [
      {
        question: QUESTION,
        options: [{ label: "The venue's map" }, { label: "Our own grid" }],
      },
    ],
    input: {},
  };
  emit(ev);
  return { id, ev };
}

const questionWaiting: Waiting = {
  plan: PLAN,
  on: "question",
  step: "Brief",
  decision: QUESTION,
  accept: "The venue's map",
  alternative: "Our own grid",
  requestId: "req-1",
};

const approvalWaiting: Waiting = {
  plan: PLAN,
  on: "approval",
  step: "Impl",
  decision: "The plan is written. Approve it?",
  accept: "Approve",
  alternative: "Not yet — keep planning",
};

const reviewWaiting: Waiting = {
  plan: PLAN,
  on: "review",
  step: "Review",
  decision: "The build waits for your review. Accept it?",
  accept: "Accept",
  alternative: "Not yet — send it back",
};

describe("A15 — choosing an answer gives the running agent that answer", () => {
  it("A15 accept answers the session's question with the first option, through the manager", async () => {
    const { ev } = askingSession();
    const r = await answerDecision(deps(), PROJECT, questionWaiting, {
      choice: "accept",
    });
    expect(fake.answer).toHaveBeenCalledWith(ev, {
      [QUESTION]: "The venue's map",
    });
    expect(r.via).toBe("question");
    expect(recorded).toEqual([
      {
        decision: QUESTION,
        answer: "The venue's map",
        by: "person",
        at: "2026-10-10T10:00:00.000Z",
      },
    ]);
  });

  it("A15 the alternative answers with the other option", async () => {
    const { ev } = askingSession();
    await answerDecision(deps(), PROJECT, questionWaiting, {
      choice: "alternative",
    });
    expect(fake.answer).toHaveBeenCalledWith(ev, {
      [QUESTION]: "Our own grid",
    });
  });

  it("A15 the agent carries on: the question is answered once, and a second answer is refused", async () => {
    askingSession();
    await answerDecision(deps(), PROJECT, questionWaiting, {
      choice: "accept",
    });
    await expect(
      answerDecision(deps(), PROJECT, questionWaiting, { choice: "accept" }),
    ).rejects.toThrow(/already answered/);
    expect(fake.answer).toHaveBeenCalledTimes(1);
    expect(recorded).toHaveLength(1);
  });

  it("A15 accept on approval approves the plan; on review it accepts the plan and starts its release", async () => {
    const d = deps();
    await answerDecision(d, PROJECT, approvalWaiting, { choice: "accept" });
    expect(d.approve).toHaveBeenCalledTimes(1);
    await answerDecision(d, PROJECT, reviewWaiting, { choice: "accept" });
    expect(d.release).toHaveBeenCalledTimes(1);
    expect(recorded.map((e) => e.answer)).toEqual(["Approve", "Accept"]);
  });

  it("A15 an action that fails records nothing", async () => {
    const d = deps({
      approve: async () => {
        throw new Error("the brief check refuses");
      },
    });
    await expect(
      answerDecision(d, PROJECT, approvalWaiting, { choice: "accept" }),
    ).rejects.toThrow(/brief check/);
    expect(recorded).toEqual([]);
  });
});

describe("A16 — a reply in words reaches the plan's agent, running or not", () => {
  it("A16 with a session running for the plan, the words are said to it", async () => {
    manager.start({
      project: PROJECT,
      plan: PLAN,
      cwd: WORKTREE,
      kind: "build",
      prompt: "/work",
      onEvent: () => {},
    });
    const r = await answerDecision(deps(), PROJECT, reviewWaiting, {
      choice: "reply",
      text: "The hold time should be five minutes, not ten.",
    });
    expect(fake.say).toHaveBeenCalledWith(
      "The hold time should be five minutes, not ten.",
    );
    expect(launched).toHaveLength(1);
    expect(r.via).toBe("say");
    expect(recorded[0]?.answer).toBe(
      "The hold time should be five minutes, not ten.",
    );
  });

  it("A16 with a question pending, the words are its answer", async () => {
    const { ev } = askingSession();
    await answerDecision(deps(), PROJECT, questionWaiting, {
      choice: "reply",
      text: "Neither — ask the venue",
    });
    expect(fake.answer).toHaveBeenCalledWith(ev, {
      [QUESTION]: "Neither — ask the venue",
    });
  });

  it("A16 with no session running, one is started for the plan in its worktree with the decision and the words", async () => {
    const r = await answerDecision(deps(), PROJECT, approvalWaiting, {
      choice: "reply",
      text: "Split Build Phase 2 in two first.",
    });
    expect(launched).toHaveLength(1);
    expect(launched[0]?.cwd).toBe(WORKTREE);
    expect(launched[0]?.prompt).toContain(approvalWaiting.decision);
    expect(launched[0]?.prompt).toContain("Split Build Phase 2 in two first.");
    expect(manager.forPlan(PROJECT, PLAN)).toMatchObject({
      project: PROJECT,
      plan: PLAN,
    });
    expect(r.via).toBe("session");
    expect(r.sessionId).toBe(manager.forPlan(PROJECT, PLAN)?.id);
  });

  it("A16 the alternative on review goes to the agent as words", async () => {
    await answerDecision(deps(), PROJECT, reviewWaiting, {
      choice: "alternative",
    });
    expect(launched[0]?.prompt).toContain("Not yet — send it back");
    expect(recorded[0]?.answer).toBe("Not yet — send it back");
  });

  it("A16 an empty reply is refused and nothing is recorded", async () => {
    await expect(
      answerDecision(deps(), PROJECT, approvalWaiting, {
        choice: "reply",
        text: "  ",
      }),
    ).rejects.toThrow();
    expect(launched).toHaveLength(0);
    expect(recorded).toEqual([]);
  });
});

describe("A38 — an answer delivered and not recorded is not a failed answer", () => {
  it("A38 a history that cannot be written still reports the answer sent, with why it was not recorded", async () => {
    const d = deps({
      record: () => {
        throw new Error("the lock on current.md timed out");
      },
    });
    const r = await answerDecision(d, PROJECT, approvalWaiting, {
      choice: "accept",
    });
    expect(d.approve).toHaveBeenCalledTimes(1);
    expect(r.via).toBe("approve");
    expect(r.commit.committed).toBe(false);
    expect(JSON.stringify(r.commit)).toContain("lock on current.md");
  });
});

// promise: a-question-is-answered-in-full
describe("cockpit-audit-fixes A7 — an ask of two questions is answered in full", () => {
  it("A7 the agent gets an answer to each question, under each question's text", async () => {
    const { id } = manager.start({
      project: PROJECT,
      plan: PLAN,
      cwd: WORKTREE,
      kind: "planning",
      prompt: `/planner ${PLAN}`,
      onEvent: () => {},
    });
    void id;
    const ev: QuestionEvent = {
      type: "question",
      requestId: "req-2",
      questions: [
        {
          question: QUESTION,
          options: [{ label: "The venue's map" }, { label: "Our own grid" }],
        },
        {
          question: "How long should a hold last?",
          options: [{ label: "Ten minutes" }, { label: "One hour" }],
        },
      ],
      input: {},
    };
    const emit = launched[0]?.onEvent as SessionOptions["onEvent"];
    emit(ev);
    const waiting = {
      ...questionWaiting,
      requestId: "req-2",
      questions: [
        {
          question: QUESTION,
          accept: "The venue's map",
          alternative: "Our own grid",
        },
        {
          question: "How long should a hold last?",
          accept: "Ten minutes",
          alternative: "One hour",
        },
      ],
    } as Waiting;
    const answers = {
      [QUESTION]: "Our own grid",
      "How long should a hold last?": "Ten minutes",
    };
    await answerDecision(deps(), PROJECT, waiting, {
      choice: "answers",
      answers,
    } as never);
    expect(fake.answer).toHaveBeenCalledWith(ev, answers);
  });
});

describe("A16 (plan-stories) — an amendment is answered on its own card", () => {
  it("A16 an answer to an amendment's wait is refused and neither approves nor releases", async () => {
    const approve = vi.fn(async () => ({}));
    const release = vi.fn(async () => ({}));
    const waiting: Waiting = {
      plan: PLAN,
      on: "amendment",
      step: "Brief",
      decision: AMENDMENT_DECISION,
      accept: "Approve",
      alternative: "Not yet",
    };
    await expect(
      answerDecision(deps({ approve, release }), PROJECT, waiting, {
        choice: "accept",
      }),
    ).rejects.toThrow(/amendment card/);
    expect(approve).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
});
