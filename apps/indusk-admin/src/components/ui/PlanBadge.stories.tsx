import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanBadge } from "./PlanBadge";

const meta = {
  title: "ui/PlanBadge",
  component: PlanBadge,
} satisfies Meta<typeof PlanBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Needs: Story = { args: { state: "needs", children: "UP" } };
export const Working: Story = { args: { state: "working", children: "MM" } };
export const Released: Story = { args: { state: "released", children: "BT" } };
export const Idle: Story = { args: { state: "idle", children: "CR" } };
