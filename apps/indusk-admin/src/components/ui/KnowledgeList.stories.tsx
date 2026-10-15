import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { KnowledgeList } from "./KnowledgeList";

const meta = {
  title: "ui/KnowledgeList",
  component: KnowledgeList,
} satisfies Meta<typeof KnowledgeList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { label: "Why — goals and success criteria", state: "settled" },
      { label: "What — eight milestones", state: "settled" },
      { label: "How and where — asking now", state: "asking" },
      { label: "Name and place", state: "open" },
    ],
  },
};
