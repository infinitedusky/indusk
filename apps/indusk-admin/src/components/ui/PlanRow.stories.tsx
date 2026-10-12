import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanRow } from "./PlanRow";

const meta = {
  title: "ui/PlanRow",
  component: PlanRow,
} satisfies Meta<typeof PlanRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Needs: Story = {
  args: {
    initials: "UP",
    state: "needs",
    name: "ui-promises",
    stage: "Approve the cockpit mockups",
  },
};
export const Working: Story = {
  args: {
    initials: "MM",
    state: "working",
    name: "mockup-matching",
    stage: "Building · 2 of 5",
  },
};
export const Released: Story = {
  args: {
    initials: "BT",
    state: "released",
    name: "browser-template-claims",
    stage: "Landed",
  },
};
// The plan that is open: the row ringed in the dusk colour, as the nav draws it on that plan's page.
export const Current: Story = {
  args: {
    initials: "UP",
    state: "needs",
    name: "ui-promises",
    stage: "Approve the cockpit mockups",
    current: true,
  },
};
