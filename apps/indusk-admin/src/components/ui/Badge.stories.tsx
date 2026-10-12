import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

// One story per state `Badge` renders — its `variant`, which is its only state.
//
// Reconciliation with the mockups (storybook-components Build Phase 1): this
// file marks its element `data-component="chip"`, and the colours it draws are
// the mockups' `chip` states — passing = enforced, blocked = broken, skipped =
// proving, written = active, planned/neutral = declared. The mockups' `badge`
// (a plan's initials square with a status dot: needs, working, released) is a
// different component this file does not implement. Build Phases 2 and 5
// settle the names.
const meta = {
  title: "ui/Badge",
  component: Badge,
  args: { children: "state" },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Passing: Story = {
  args: { variant: "passing", children: "passing" },
};
export const Blocked: Story = {
  args: { variant: "blocked", children: "blocked" },
};
export const Skipped: Story = {
  args: { variant: "skipped", children: "skipped" },
};
export const Planned: Story = {
  args: { variant: "planned", children: "planned" },
};
export const Writable: Story = {
  args: { variant: "writable", children: "writable" },
};
export const Written: Story = {
  args: { variant: "written", children: "written" },
};
export const Unknown: Story = {
  args: { variant: "unknown", children: "unknown" },
};
export const Neutral: Story = {
  args: { variant: "neutral", children: "neutral" },
};
