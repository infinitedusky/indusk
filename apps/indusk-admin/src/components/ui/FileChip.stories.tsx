import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FileChip } from "./FileChip";

const meta = {
  title: "ui/FileChip",
  component: FileChip,
} satisfies Meta<typeof FileChip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Homework Gate Project Brief.md" },
};
