// promise: decisions-wait-in-one-place
// clause: a-decision-is-a-question/asked-with-a-recommendation
// clause: the-cost-sets-the-wait/the-setting-decides
// clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan
// clause: a-late-answer-opens-a-follow-on/every-decision-stays

import type { Question } from "@infinitedusky/indusk-mcp/questions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

vi.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ refresh: () => {} }),
}));
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: unknown;
  }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));

import { QuestionRows } from "./QuestionRows";

/**
 * decisions-as-questions T2, T6, T13, T14 (the page's half): a question an unattended
 * session asked appears with its options, the recommended one marked with its reason,
 * and its cost; one that went ahead says what was done and when; the follow-on a late
 * answer opened is linked; and a question in each of its four states is readable.
 */
const NOW = Date.parse("2026-10-19T12:00:00Z");
const base: Question = {
  id: "q-1",
  plan: "seat-holds",
  text: "Which store?",
  options: [
    { label: "sqlite", changes: [] },
    { label: "files", changes: [] },
  ],
  recommended: "sqlite",
  reason: "simplest to run",
  statedCost: "cheap",
  cost: "cheap",
  askedAt: NOW - 60_000,
  dueAt: NOW + 4 * 60_000,
  state: "waiting",
};

let posts: Array<{ url: string; body: unknown }>;
beforeEach(() => {
  posts = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
    posts.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return Response.json({});
  });
});
afterEach(() => vi.restoreAllMocks());

/** Render, then let React commit: the browser harness paints a tick after `render` resolves. */
const view = async (element: Parameters<typeof render>[0]) => {
  const out = await render(element);
  await new Promise((r) => setTimeout(r, 50));
  return out;
};

const rows = (root: HTMLElement) =>
  [
    ...root.querySelectorAll('[data-component="question-row"]'),
  ] as HTMLElement[];

describe("T2 — a question appears with its options, recommendation, reason and cost", () => {
  it("shows the question, the recommended option marked, the reason, the cost and the time left", async () => {
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[base]}
        now={NOW}
      />,
    );
    const [row] = rows(container);
    expect(row?.getAttribute("data-cost")).toBe("cheap");
    expect(row?.textContent).toContain("Which store?");
    expect(row?.textContent).toContain("Recommended: sqlite");
    expect(row?.textContent).toContain("simplest to run");
    expect(row?.textContent).toContain("goes ahead in 4 min");
    const buttons = [...(row?.querySelectorAll("button") ?? [])].map(
      (b) => b.textContent,
    );
    expect(buttons.join("|")).toMatch(/sqlite\s*recommended/);
    expect(buttons).toContain("files");
    expect(buttons).toContain("Reply in words");
  });

  it("an expensive question is drawn first, in red, with no timer", async () => {
    const expensive: Question = {
      ...base,
      id: "q-2",
      text: "Drop the promise?",
      cost: "expensive",
      dueAt: null,
    };
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[base, expensive]}
        now={NOW}
      />,
    );
    const [first] = rows(container);
    expect(first?.getAttribute("data-cost")).toBe("expensive");
    expect(first?.textContent).toContain(
      "the build is stopped until you answer",
    );
    expect(first?.textContent).not.toMatch(/goes ahead in/);
  });

  it("an option posts the answer to the plan's question route; an empty reply sends nothing", async () => {
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[base]}
        now={NOW}
      />,
    );
    const files = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "files",
    ) as HTMLElement;
    files.click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      url: "/api/plans/seat-holds/question",
      body: { project: "p", id: "q-1", text: "files" },
    });
    await new Promise((r) => setTimeout(r, 100)); // the answer settles before the next click
    const reply = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Reply in words",
    ) as HTMLElement;
    reply.click();
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-testid="question-send"]'),
      ).not.toBeNull(),
    );
    expect(
      (
        container.querySelector(
          '[data-testid="question-send"]',
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe("T6 — a question that went ahead says what was done and when", () => {
  const went: Question = {
    ...base,
    state: "went-ahead",
    done: "sqlite",
    wentAheadAt: NOW - 12 * 60_000,
  };
  it("names the choice made, when, and offers the other option as a late answer", async () => {
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[went]}
        now={NOW}
      />,
    );
    const [row] = rows(container);
    expect(row?.getAttribute("data-went-ahead")).toBe("true");
    expect(row?.textContent).toContain("went ahead with sqlite");
    expect(row?.textContent).toContain("12 min ago");
    expect(row?.textContent).toContain("Choose files instead");
    expect(row?.textContent).toContain("opens a follow-on plan");
  });
});

describe("T37 — what was done can be kept in one click", () => {
  it("answers with what was done, which differs from nothing, and offers another choice beside it", async () => {
    const went: Question = {
      ...base,
      state: "went-ahead",
      done: "sqlite",
      wentAheadAt: NOW - 60_000,
    };
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[went]}
        now={NOW}
      />,
    );
    const keep = container.querySelector(
      '[data-testid="question-keep"]',
    ) as HTMLElement;
    expect(keep.textContent).toBe("Keep sqlite");
    expect(container.textContent).toContain("Choose files instead");
    keep.click();
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.body).toMatchObject({ id: "q-1", text: "sqlite" });
  });

  it("a question still waiting has no keep", async () => {
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[base]}
        now={NOW}
      />,
    );
    expect(container.querySelector('[data-testid="question-keep"]')).toBeNull();
  });
});

describe("T13, T14 — every state is readable, and the follow-on is linked", () => {
  it("lists answered and late-answered questions with recommendation, answer, what was done and the follow-on link", async () => {
    const answered: Question = {
      ...base,
      id: "q-1",
      state: "answered",
      answer: "files",
    };
    const late: Question = {
      ...base,
      id: "q-2",
      state: "answered-late",
      done: "sqlite",
      answer: "files",
      followOn: "seat-holds-q-2",
    };
    const { container } = await view(
      <QuestionRows
        project="p"
        plan="seat-holds"
        questions={[answered, late]}
        now={NOW}
      />,
    );
    expect(rows(container)).toHaveLength(0);
    const items = [
      ...container.querySelectorAll('[data-testid="questions-answered"] li'),
    ] as HTMLElement[];
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toContain("recommended sqlite");
    expect(items[0]?.textContent).toContain("answered files");
    expect(items[1]?.textContent).toContain("went ahead with sqlite");
    expect(items[1]?.textContent).toContain("(late)");
    const link = items[1]?.querySelector('[data-testid="question-follow-on"]');
    expect(link?.getAttribute("href")).toBe("/p/p/plan/seat-holds-q-2");
  });

  it("a plan with no questions draws nothing", async () => {
    const { container } = await view(
      <QuestionRows project="p" plan="seat-holds" questions={[]} now={NOW} />,
    );
    expect(container.querySelector('[data-testid="question-rows"]')).toBeNull();
  });
});
