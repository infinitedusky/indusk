// promise: decisions-wait-in-one-place
// promise: a-review-shows-its-evidence

import type { Review } from "@infinitedusky/indusk-mcp/build";
import type { Waiting } from "@infinitedusky/indusk-mcp/plans/waiting";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ refresh: () => {} }),
}));

import { DecisionCard } from "./DecisionCard";

/**
 * plan-cockpit A14 and A35: a waiting plan's page shows exactly one decision,
 * with accept, the alternative and a reply in words; a plan stopped for review
 * shows, with its decision, each promise with the passing tests that prove
 * it, what falsification found and fixed, and the files changed — and
 * accepting it there accepts the plan (the card posts the answer to the
 * plan's decision route, which accepts it as BuildControls' Accept does).
 */

const PROJECT = "seats";

const question: Waiting = {
  plan: "asking",
  on: "question",
  step: "Brief",
  decision: "Which seat map should holds use?",
  accept: "The venue's map",
  alternative: "Our own grid",
  requestId: "req-1",
};

const review: Waiting = {
  plan: "at-review",
  on: "review",
  step: "Review",
  decision: "The build is done and waits for your review. Accept it?",
  accept: "Accept",
  alternative: "Not yet — send it back",
};

const evidence: Review = {
  plan: "at-review",
  promises: [
    {
      name: "seat-released-on-timeout",
      proven: true,
      rows: [{ id: "A1", state: "passing", tests: ["src/seat.test.ts"] }],
      why: null,
    },
  ],
  falsification: [
    {
      phase: "Build Phase 3: Falsification — holds that never expire",
      rows: [
        {
          id: "F1",
          asserts: "a hold whose clock goes backwards still expires",
          state: "passing",
        },
      ],
      items: [{ text: "read the expiry from a monotonic clock", done: true }],
    },
  ],
  files: [{ path: "src/seat.ts", status: "M" }],
  evidence: [],
  uncommittedOnMain: [],
  skippedRituals: [],
  skips: [],
};

let posts: Array<{ url: string; body: unknown }>;

beforeEach(() => {
  posts = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ answer: "ok" });
    }
    if (url.startsWith("/api/plans/review")) return Response.json(evidence);
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

const cards = (root: HTMLElement) =>
  root.querySelectorAll('[data-testid="decision-card"]');

describe("A14 — one decision, with accept, the alternative and a reply", () => {
  it("A14 shows exactly one card naming the decision and the step, with three ways to answer", async () => {
    const { container } = await render(
      <DecisionCard project={PROJECT} waiting={question} />,
    );
    expect(cards(container)).toHaveLength(1);
    const card = cards(container)[0] as HTMLElement;
    expect(card.textContent).toContain("Which seat map should holds use?");
    expect(card.textContent).toContain("Brief");
    expect(
      card.querySelector('[data-testid="decision-accept"]')?.textContent,
    ).toContain("The venue's map");
    expect(
      card.querySelector('[data-testid="decision-alternative"]')?.textContent,
    ).toContain("Our own grid");
    expect(
      card.querySelector('textarea[data-testid="decision-reply"]'),
    ).not.toBeNull();
    expect(card.querySelector('[data-testid="decision-send"]')).not.toBeNull();
  });

  it("A14 each control posts its answer to the plan's decision route", async () => {
    const { container } = await render(
      <DecisionCard project={PROJECT} waiting={question} />,
    );
    const card = cards(container)[0] as HTMLElement;
    (
      card.querySelector('[data-testid="decision-alternative"]') as HTMLElement
    ).click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      url: "/api/plans/asking/decision",
      body: { project: PROJECT, choice: "alternative", on: "question" },
    });
  });

  it("A14 a reply in words is sent with its words", async () => {
    const screen = await render(
      <DecisionCard project={PROJECT} waiting={question} />,
    );
    await screen
      .getByTestId("decision-reply")
      .fill("Neither — ask the venue first");
    await screen.getByTestId("decision-send").click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.body).toEqual({
      project: PROJECT,
      choice: "reply",
      text: "Neither — ask the venue first",
    });
  });
});

describe("A35 — a review shows its evidence with its decision, and accepting it there accepts the plan", () => {
  it("A35 shows each promise with its passing tests, what falsification found and fixed, and the files changed", async () => {
    const { container } = await render(
      <DecisionCard project={PROJECT} waiting={review} />,
    );
    const card = cards(container)[0] as HTMLElement;
    await vi.waitFor(() =>
      expect(card.querySelector('[data-testid="review-panel"]')).not.toBeNull(),
    );
    const text = card.textContent ?? "";
    expect(text).toContain("seat-released-on-timeout");
    expect(text).toContain("A1");
    expect(text).toContain("a hold whose clock goes backwards still expires");
    expect(text).toContain("Fixed: read the expiry from a monotonic clock");
    expect(text).toContain("src/seat.ts");
  });

  it("A35 Accept on the card accepts the plan", async () => {
    const { container } = await render(
      <DecisionCard project={PROJECT} waiting={review} />,
    );
    const card = cards(container)[0] as HTMLElement;
    const accept = card.querySelector(
      '[data-testid="decision-accept"]',
    ) as HTMLElement;
    expect(accept.textContent).toContain("Accept");
    accept.click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      url: "/api/plans/at-review/decision",
      body: { project: PROJECT, choice: "accept", on: "review" },
    });
  });
});

// promise: a-question-is-answered-in-full
describe("cockpit-audit-fixes A7 — every question the agent asked is on the card", () => {
  const two = {
    ...question,
    plan: "asking-two",
    questions: [
      {
        question: "Which seat map should holds use?",
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

  it("A7 both questions are shown, and answering both posts an answer under each question's text", async () => {
    const screen = await render(
      <DecisionCard project={PROJECT} waiting={two} />,
    );
    const text = screen.container.textContent ?? "";
    expect(text).toContain("Which seat map should holds use?");
    expect(text).toContain("How long should a hold last?");
    await screen.getByText("Our own grid").click();
    await screen.getByText("Ten minutes").click();
    await screen.getByTestId("decision-send-answers").click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.body).toEqual({
      project: PROJECT,
      choice: "answers",
      answers: {
        "Which seat map should holds use?": "Our own grid",
        "How long should a hold last?": "Ten minutes",
      },
    });
  });
});

// promise: a-question-is-answered-in-full
describe("cockpit-audit-fixes A14 — a several-question ask takes the person's own words per question", () => {
  const two = {
    ...question,
    plan: "asking-two",
    questions: [
      {
        question: "Which seat map should holds use?",
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

  it("A14 words typed under a question are sent as its answer, beside a chosen option for the other", async () => {
    const screen = await render(
      <DecisionCard project={PROJECT} waiting={two} />,
    );
    const fields = screen.container.querySelectorAll(
      '[data-testid="decision-question-words"]',
    );
    expect(fields).toHaveLength(2);
    await screen.getByText("Our own grid").click();
    await screen
      .getByTestId("decision-question-words")
      .nth(1)
      .fill("Until the show starts");
    await screen.getByTestId("decision-send-answers").click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.body).toEqual({
      project: PROJECT,
      choice: "answers",
      answers: {
        "Which seat map should holds use?": "Our own grid",
        "How long should a hold last?": "Until the show starts",
      },
    });
  });
});

describe("approval-waits-for-the-planning-run A20 — a plan-review wait is drawn in the ask state", () => {
  const needsReview: Waiting = {
    plan: "written",
    on: "plan-review",
    step: "Impl",
    decision: "The plan needs its plan review: plan-review.md, answered.",
    accept: "Ask the agent to write it",
    alternative: "Not yet",
  };

  it("A20 headed as needing its plan review at the step, with the decision's words", async () => {
    const screen = await render(
      <DecisionCard project={PROJECT} waiting={needsReview} />,
    );
    // Waits for the card: the first render may not have flushed yet.
    await vi.waitFor(() =>
      expect(screen.getByTestId("decision-card").element()).toBeTruthy(),
    );
    const card = screen.getByTestId("decision-card").element();
    expect(card.getAttribute("data-on")).toBe("plan-review");
    expect(card.textContent).toContain("Needs its plan review at Impl");
    expect(card.textContent).toContain("The plan needs its plan review");
  });
});

// promise: decisions-wait-in-one-place
describe("approval-waits-for-the-planning-run A23 — an answer names the decision the card showed", () => {
  it("A23 a plan-review card posts on: plan-review with its answer", async () => {
    const screen = await render(
      <DecisionCard
        project={PROJECT}
        waiting={{
          plan: "written",
          on: "plan-review",
          step: "Impl",
          decision: "The plan needs its plan review.",
          accept: "Ask the agent to write it",
          alternative: "Not yet",
        }}
      />,
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("decision-card").element()).toBeTruthy(),
    );
    (screen.getByTestId("decision-accept").element() as HTMLElement).click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.body).toEqual({
      project: PROJECT,
      choice: "accept",
      on: "plan-review",
    });
  });
});
