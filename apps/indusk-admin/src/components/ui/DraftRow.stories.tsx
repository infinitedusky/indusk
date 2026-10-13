import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DraftRow } from "./DraftRow";

const meta = {
  title: "ui/DraftRow",
  component: DraftRow,
} satisfies Meta<typeof DraftRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "a way to see which plans touch the interface",
    age: "last talked 2h ago",
  },
};
export const Aged: Story = {
  args: {
    title: "rename the nav sections",
    age: "untouched 12 days",
    aged: true,
  },
};
