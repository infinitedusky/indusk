import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ViewLink } from "./ViewLink";

// States the mockups show: a view, and the view that is open.
const meta = {
  title: "ui/ViewLink",
  component: ViewLink,
} satisfies Meta<typeof ViewLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { icon: "P", label: "Promises", count: 1 },
};
export const Current: Story = {
  args: { icon: "P", label: "Promises", count: 1, current: true },
};
