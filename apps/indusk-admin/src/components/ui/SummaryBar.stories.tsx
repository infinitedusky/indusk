import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SummaryBar } from "./SummaryBar";

const meta = {
  title: "ui/SummaryBar",
  component: SummaryBar,
} satisfies Meta<typeof SummaryBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    counts: { broken: 1, proving: 2, declared: 1, enforced: 9 },
    note: "13 promises across 4 plans",
  },
};
