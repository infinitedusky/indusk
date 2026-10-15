import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { HistoryPanel } from "./HistoryPanel";

const entries = [
  {
    at: "2026-10-12T11:48:00Z",
    by: "workflow",
    decision: "Which phase to start first",
    answer: "Test Phase 1",
  },
  {
    at: "2026-10-12T16:05:00Z",
    by: "Sandy",
    decision: "Brief accepted",
    answer: "Approve",
  },
  {
    at: "2026-10-12T17:30:00Z",
    by: "Sandy",
    decision: "Amendment to a-plan-page-shows-the-parts-of-its-brief",
    answer: "Approve",
  },
  {
    at: "2026-10-13T09:12:00Z",
    by: "workflow",
    decision: "The plan waited on the build order",
    answer: "Build Phase 4 before Phase 5",
  },
  {
    at: "2026-10-13T09:41:00Z",
    by: "Sandy",
    decision: "Looks for the plan page approved",
    answer: "Approve",
  },
];

const meta = {
  title: "ui/HistoryPanel",
  component: HistoryPanel,
  args: { entries },
} satisfies Meta<typeof HistoryPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { open: true } };
