import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Stat } from "./Stat";

const meta = {
  title: "ui/Stat",
  component: Stat,
} satisfies Meta<typeof Stat>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "Tests", value: "3", note: "1 written" },
};
export const Ok: Story = {
  args: { label: "Held", value: "29", note: "last 30 days", tone: "ok" },
};
export const Bad: Story = {
  args: { label: "Broken", value: "1", note: "now", tone: "bad" },
};
