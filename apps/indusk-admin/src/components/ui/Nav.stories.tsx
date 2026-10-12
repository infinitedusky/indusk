import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Nav, NavGroup } from "./Nav";
import { PlanRow } from "./PlanRow";
import { ViewLink } from "./ViewLink";

const meta = {
  title: "ui/Nav",
  component: Nav,
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = (
  <>
    <NavGroup label="Needs you" count={1} />
    <PlanRow
      initials="UP"
      state="needs"
      name="ui-promises"
      stage="Approve the cockpit mockups"
    />
    <NavGroup label="In flight" count={1} />
    <PlanRow
      initials="MM"
      state="working"
      name="mockup-matching"
      stage="Building · 2 of 5"
    />
    <ViewLink icon="P" label="Promises" count={1} current />
    <ViewLink icon="L" label="Looks" count={0} />
  </>
);

export const Expanded: Story = {
  args: { project: "dusk", summary: "9 plans", children: rows },
};
export const Collapsed: Story = {
  args: {
    project: "dusk",
    summary: "9 plans",
    collapsed: true,
    children: rows,
  },
};
