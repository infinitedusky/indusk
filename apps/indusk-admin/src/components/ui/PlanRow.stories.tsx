import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PlanRow } from "./PlanRow";
import { WorktreeMark } from "./WorktreeMark";

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
// A plan in a Path: its place first, the column kept for plans beside it.
export const Numbered: Story = {
  args: {
    number: 3,
    initials: "DW",
    state: "released",
    name: "dawn-workbench-execution",
    stage: "Released",
  },
};
// A draft nobody is working: the grey dot.
export const Idle: Story = {
  args: {
    initials: "CR",
    state: "idle",
    name: "context-reaches-every-session",
    stage: "Brief · draft",
  },
};
// Declared in a master, not made yet: the stage in italics, no page behind it.
export const Queued: Story = {
  args: {
    number: 4,
    initials: "AU",
    state: "idle",
    name: "admin-ui-phase-progress",
    stage: "Queued",
    queued: true,
  },
};
// A plan with a worktree: a mark beside the stage, outside the row's link.
export const Worktree: Story = {
  args: {
    initials: "NS",
    state: "needs",
    name: "The nav says where a plan is",
    stage: "Approve the brief",
    worktree: <WorktreeMark name="nav-stage-matches-plan-page" />,
  },
};
