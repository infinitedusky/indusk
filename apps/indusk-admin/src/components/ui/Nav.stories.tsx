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

const rows = (current: "promises" | "looks") => (
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
    <ViewLink
      icon="P"
      label="Promises"
      count={1}
      current={current === "promises"}
    />
    <ViewLink icon="L" label="Looks" count={0} current={current === "looks"} />
  </>
);

export const Expanded: Story = {
  args: { project: "dusk", summary: "9 plans", children: rows("promises") },
};
// The Looks page's nav: the same frame with the Looks view the open one.
export const LooksCurrent: Story = {
  args: { project: "dusk", summary: "9 plans", children: rows("looks") },
};
export const Collapsed: Story = {
  args: {
    project: "dusk",
    summary: "9 plans",
    collapsed: true,
    children: rows("promises"),
  },
};
