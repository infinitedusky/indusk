import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Step } from "./Step";

const meta = {
  title: "ui/Step",
  component: Step,
} satisfies Meta<typeof Step>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {
  args: { name: "Research", status: "done", state: "done" },
};
export const Working: Story = {
  args: { name: "Build", status: "working", state: "working", current: true },
};
export const Needs: Story = {
  args: {
    name: "Review",
    status: "waiting for you",
    state: "needs",
    current: true,
  },
};
export const Waiting: Story = {
  args: { name: "Land", status: "waiting", state: "waiting" },
};
export const Skipped: Story = {
  args: {
    name: "Cleanup",
    status: "skipped",
    state: "waiting",
    reason:
      "Nothing to extract: the changed files are cohesive and none repeats another.",
  },
};
export const SkippedOpen: Story = {
  args: { ...Skipped.args, open: true },
};
