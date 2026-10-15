import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { SubplanRow } from "./SubplanRow";

const meta = {
  title: "ui/SubplanRow",
  component: SubplanRow,
} satisfies Meta<typeof SubplanRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Released: Story = {
  args: {
    number: 5,
    initials: "DP",
    state: "released",
    title: "Day promises",
    description:
      "Promises become files the project keeps, with a check that refuses any that lie.",
    stage: "Released",
    href: "/p/dusk/plan/day-promises",
  },
};
export const Draft: Story = {
  args: {
    number: 18,
    initials: "WF",
    state: "draft",
    title: "Watched from day one",
    description:
      "A new workbench gets its own watching server when it is created.",
    stage: "Draft, parked",
    href: "/p/dusk/plan/workbench-watch-provisioning",
  },
};
// Declared in the master, not made yet: dimmed, nothing behind it.
export const Queued: Story = {
  args: {
    number: 19,
    initials: "CC",
    state: "queued",
    title: "Check at change time",
    description:
      "Code that touches a promise, in a plan that does not name it, is recorded.",
    stage: "Queued",
  },
};
