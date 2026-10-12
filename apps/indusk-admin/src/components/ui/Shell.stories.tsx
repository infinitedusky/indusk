import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Nav } from "./Nav";
import { PlanRow } from "./PlanRow";
import { Shell } from "./Shell";
import { ViewLink } from "./ViewLink";

const meta = {
  title: "ui/Shell",
  component: Shell,
} satisfies Meta<typeof Shell>;

export default meta;
type Story = StoryObj<typeof meta>;

const nav = (collapsed: boolean) => (
  <Nav project="dusk" summary="9 plans" collapsed={collapsed}>
    <PlanRow
      initials="UP"
      state="needs"
      name="ui-promises"
      stage="Approve the cockpit mockups"
    />
    <ViewLink icon="P" label="Promises" count={1} current />
  </Nav>
);

const page = (
  <main className="min-w-0 px-6 pb-16">
    <h1 className="pt-5 font-display text-4xl font-bold leading-7">Plans</h1>
  </main>
);

export const Default: Story = {
  args: { children: [nav(false), page] },
};
export const Collapsed: Story = {
  args: { collapsed: true, children: [nav(true), page] },
};
