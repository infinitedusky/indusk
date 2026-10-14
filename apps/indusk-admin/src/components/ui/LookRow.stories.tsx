import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LookRow } from "./LookRow";

const meta = {
  title: "ui/LookRow",
  component: LookRow,
} satisfies Meta<typeof LookRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {
  args: { kind: "mockup", name: "dashboard.default", approval: "approved" },
};
export const Proposed: Story = {
  args: { kind: "mockup", name: "promise.broken", approval: "proposed" },
};
export const Uncovered: Story = {
  args: { kind: "mockup", name: "plan.released", approval: "uncovered" },
};

/** A mockup is a drawing: the kind leads, above the name. */
export const KindMockup: Story = {
  args: { kind: "mockup", name: "new-project.no-parent", approval: "proposed" },
};
/** A story is the built component: the kind leads, above the name. */
export const KindStory: Story = {
  args: { kind: "story", name: "message.agent-working", approval: "proposed" },
};
