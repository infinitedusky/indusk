import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { WorkflowStrip } from "./WorkflowStrip";

const meta = {
  title: "ui/WorkflowStrip",
  component: WorkflowStrip,
} satisfies Meta<typeof WorkflowStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    documents: [
      { label: "Brief", state: "core" },
      { label: "Test plan", state: "core" },
      { label: "ADR", state: "off" },
      { label: "Impl", state: "kept" },
      { label: "Retrospective", state: "kept" },
    ],
  },
};
