import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PromptBox } from "./PromptBox";

const meta = {
  title: "ui/PromptBox",
  component: PromptBox,
} satisfies Meta<typeof PromptBox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: {} };
