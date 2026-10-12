import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Nav, NavGroup } from "./Nav";
import { ViewLink } from "./ViewLink";

const meta = {
  title: "ui/Nav",
  component: Nav,
} satisfies Meta<typeof Nav>;

export default meta;
type Story = StoryObj<typeof meta>;

const rows = (
  <>
    <NavGroup label="Views" count={2} />
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
