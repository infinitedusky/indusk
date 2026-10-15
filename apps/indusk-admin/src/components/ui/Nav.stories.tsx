import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Nav, NavGroup } from "./Nav";
import { NavPath } from "./NavPath";
import { PlanRow } from "./PlanRow";
import { ViewLink } from "./ViewLink";

const meta = {
  title: "ui/Nav",
  component: Nav,
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

// The nav as the cockpit draws it: what needs the person, the views, the Paths
// with their plans numbered in order, the plans no Path claims, and the
// archive folded. `current` is the open page.
const tree = (current: "promises" | "looks" | "plan") => (
  <>
    <NavGroup label="Needs you" count={1} />
    <PlanRow
      initials="CR"
      state="needs"
      name="cockpit-redraw"
      stage="Approve 10 looks"
      current={current === "plan"}
    />
    <ViewLink icon="S" label="Scorecards" />
    <ViewLink
      icon="P"
      label="Promises"
      count="1 broken"
      current={current === "promises"}
    />
    <ViewLink icon="L" label="Looks" current={current === "looks"} />
    <NavGroup label="Paths" count={2} />
    <NavPath name="indusk-v2-dawn" count="5/8" defaultOpen={false} />
    <NavPath name="indusk-v4-day" count="17/26">
      <PlanRow
        number={1}
        initials="WT"
        state="released"
        name="workbench-trust-fixes"
        stage="Released"
      />
      <PlanRow
        number={2}
        initials="HC"
        state="released"
        name="hook-cwd-independence"
        stage="Released"
      />
      <PlanRow
        number={3}
        initials="DW"
        state="working"
        name="dawn-workbench-execution"
        stage="Building · 2 of 5"
      />
      <PlanRow
        number={4}
        initials="AU"
        state="idle"
        name="admin-ui-phase-progress"
        stage="Queued"
        queued
      />
    </NavPath>
    <NavGroup label="Plans" count={2} />
    <PlanRow
      number=""
      initials="CR"
      state="working"
      name="clean-release-build"
      stage="Building · 1 of 3"
    />
    <PlanRow
      number=""
      initials="CR"
      state="idle"
      name="context-reaches-every-session"
      stage="Brief · draft"
    />
    <NavGroup label="Unordered" count={1} />
    <PlanRow
      number=""
      initials="LC"
      state="working"
      name="looks-check-speed"
      stage="Brief · writing"
    />
    <NavPath apart defaultOpen={false} name="Archived" count={92} />
  </>
);

export const Expanded: Story = {
  args: {
    project: "dusk",
    summary: "11 plans · 1 needs you",
    children: tree("promises"),
  },
};
// The Looks page's nav: the same frame with the Looks view the open one.
export const LooksCurrent: Story = {
  args: {
    project: "dusk",
    summary: "11 plans · 1 needs you",
    children: tree("looks"),
  },
};
// A plan's page: the same frame with that plan's row the open one.
export const PlanCurrent: Story = {
  args: {
    project: "dusk",
    summary: "11 plans · 1 needs you",
    children: tree("plan"),
  },
};
export const Collapsed: Story = {
  args: {
    project: "dusk",
    summary: "11 plans · 1 needs you",
    collapsed: true,
    children: tree("promises"),
  },
};
