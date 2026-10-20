import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { QuestionRow } from "./QuestionRow";

const meta = {
  title: "ui/QuestionRow",
  component: QuestionRow,
} satisfies Meta<typeof QuestionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Cheap: Story = {
  args: {
    cost: "cheap",
    where: "q-1 · Build Phase 2",
    when: "goes ahead in 4 min",
    text: "Name the plan review's file plan-review.md or review.md?",
    reason:
      "A file called review.md would read as the build's review step, which is a different thing.",
    options: [
      { label: "plan-review.md", recommended: true },
      { label: "review.md" },
    ],
    onReply: () => {},
  },
};
export const Expensive: Story = {
  args: {
    cost: "expensive",
    where: "q-2 · Build Phase 3",
    when: "the build is stopped until you answer",
    text: "Drop the promise that landing never waits for a follow-on?",
    reason:
      "Dropping it changes a promise you approved, so this waits for you whatever it costs.",
    options: [
      { label: "Keep the promise", recommended: true },
      { label: "Drop it" },
    ],
    onReply: () => {},
  },
};
export const WentAhead: Story = {
  args: {
    cost: "cheap",
    wentAhead: true,
    where: "q-3 · Build Phase 2",
    when: "12 min ago",
    text: "Run the plan review on the work step's model or the audit's?",
    done: "the audit's model",
    options: [{ label: "the work step's model" }],
  },
};
