import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PartSection } from "./PartSection";
import { PhaseRow } from "./PhaseRow";

const pill =
  "inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-snug text-sm leading-3 font-medium";

const promises = (
  <div className="flex flex-wrap gap-2">
    {[
      ["a-brief-lists-its-looks", "bg-idle"],
      ["a-look-has-the-plan-that-owns-it", "bg-warn"],
      ["a-changed-look-keeps-its-history", "bg-ok"],
      ["a-plan-is-approved-with-its-looks-approved", "bg-idle"],
    ].map(([name, dot]) => (
      <span key={name} className={pill}>
        <span className={`size-dot rounded-pill ${dot}`} />
        {name}
      </span>
    ))}
  </div>
);

const item = (mark: string, text: string, note?: string) => (
  <li key={text} className="flex items-baseline gap-2">
    <span className="font-mono text-sm leading-3 text-ink-soft">{mark}</span>
    <div className="min-w-0">
      <div className="text-sm leading-3">{text}</div>
      {note ? (
        <div className="mt-hair text-xs leading-2 text-ink-faint">{note}</div>
      ) : null}
    </div>
  </li>
);

const phases = (
  <div className="grid gap-2">
    {[1, 2, 3].map((n) => (
      <PhaseRow
        key={n}
        name={n === 1 ? "Test Phase 1" : `Build Phase ${n - 1}`}
        count={["9 of 9", "8 of 8", "7 of 7"][n - 1]}
        state="done ✓"
        tone="done"
      />
    ))}
    <PhaseRow
      name="Build Phase 4"
      count="8 of 12"
      state="in progress"
      tone="doing"
      open
    >
      <ul className="grid list-none gap-2">
        {item(
          "☑",
          "Draw the mockups for the looks the brief already lists",
          "Six screen mockups drawn; three new components each drawn as their own mockup per state.",
        )}
        {item("☑", "Pause for a person: Sandy approves this plan's mockups")}
        {item("☐", "The page draws the approved layout: status first")}
      </ul>
    </PhaseRow>
    <PhaseRow
      name="Build Phase 5"
      count="0 of 10"
      state="not started"
      tone="idle"
    />
  </div>
);

const documents = (
  <div className="grid gap-2">
    {[
      ["Research", "written", "done"],
      ["Brief", "accepted", "done"],
      ["Test plan", "written", "done"],
      ["ADR", "accepted", "done"],
      ["Impl", "in progress, 38 of 52", "doing"],
    ].map(([name, state, tone]) => (
      <PhaseRow
        key={name}
        name={name}
        state={state}
        tone={tone as "done" | "doing"}
        href="#"
      />
    ))}
  </div>
);

const meta = {
  title: "ui/PartSection",
  component: PartSection,
  args: { title: "Promises", summary: "4 · 1 enforced", children: promises },
} satisfies Meta<typeof PartSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { open: true } };

/** The other parts of a plan's page, closed, as the plan screens place them. */
export const PromisesAllEnforced: Story = {
  args: { summary: "4 · 4 enforced" },
};
export const Expectations: Story = {
  args: { title: "Expectations", summary: "2 · 1 due" },
};
export const Looks: Story = {
  args: { title: "Looks", summary: "3 of 3 approved" },
};
export const LooksTwoOfThree: Story = {
  args: { title: "Looks", summary: "2 of 3 approved" },
};
export const Phases: Story = {
  args: { title: "Phases", summary: "Build Phase 4 of 5 · 38 of 52 done" },
};
export const PhasesInReview: Story = {
  args: { title: "Phases", summary: "Review · 52 of 52 done" },
};
export const PhasesDone: Story = {
  args: { title: "Phases", summary: "All phases done · 52 of 52 done" },
};
export const Documents: Story = {
  args: { title: "Documents", summary: "5 documents" },
};
export const DocumentsReleased: Story = {
  args: { title: "Documents", summary: "8 documents" },
};

/** Phases opened: each phase a row, one of them unfolded to its items and their notes. */
export const PhasesOpen: Story = {
  args: {
    title: "Phases",
    summary: "Build Phase 4 of 5 · 38 of 52 done",
    open: true,
    children: phases,
  },
};
/** Documents opened: each document a row that opens its own page. */
export const DocumentsOpen: Story = {
  args: {
    title: "Documents",
    summary: "5 documents",
    open: true,
    children: documents,
  },
};
