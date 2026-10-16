import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorktreeMark } from "./WorktreeMark";

const meta = {
  title: "ui/WorktreeMark",
  component: WorktreeMark,
  args: { name: "looks-check-speed" },
} satisfies Meta<typeof WorktreeMark>;

export default meta;
type Story = StoryObj<typeof meta>;

// Closed: the bordered glyph alone, no text.
export const Closed: Story = {};
// Open: hovered or clicked, widened in place to the worktree's name.
export const Open: Story = { args: { open: true } };
