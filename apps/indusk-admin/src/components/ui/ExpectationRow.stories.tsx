import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ExpectationRow } from "./ExpectationRow";

const meta = {
  title: "ui/ExpectationRow",
  component: ExpectationRow,
} satisfies Meta<typeof ExpectationRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "A person approves a plan from its brief alone.",
    when: "look at the close of the first plan built under the rule",
  },
};
export const Due: Story = {
  args: {
    text: "No plan that changes the interface reaches review with its looks unlisted or unapproved.",
    when: "time to look: three plans approved",
    due: true,
  },
};
