import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LookRow } from "./LookRow";

const meta = {
  title: "ui/LookRow",
  component: LookRow,
} satisfies Meta<typeof LookRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  args: { name: "dashboard.default", approval: "approved" },
};
export const Proposed: Story = {
  args: { name: "promise.broken", approval: "proposed" },
};
export const Uncovered: Story = {
  args: { name: "plan.released", approval: "uncovered" },
};
