import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LayoutTree } from "./LayoutTree";

const meta = {
  title: "ui/LayoutTree",
  component: LayoutTree,
} satisfies Meta<typeof LayoutTree>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: [
      "homework-gate-workbench/",
      "  homework-gate/      the repository",
      "  worktrees/          one per plan",
    ].join("\n"),
  },
};
