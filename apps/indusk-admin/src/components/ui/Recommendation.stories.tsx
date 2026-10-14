import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Recommendation } from "./Recommendation";

const meta = {
  title: "ui/Recommendation",
  component: Recommendation,
} satisfies Meta<typeof Recommendation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Kept: Story = {
  args: {
    state: "kept",
    title: "A docs site with a changelog",
    why: "So others can join in: what was built, why, and what changed, in one place.",
    action: (
      <Button variant="secondary" size="sm">
        Decline
      </Button>
    ),
  },
};

export const Declined: Story = {
  args: {
    state: "declined",
    title: "Decision records (ADRs)",
    why: "A record of why each choice was made, so a later contributor doesn't undo it.",
    reason: "Solo project for now; I'll turn them on when someone joins.",
    action: (
      <Button variant="secondary" size="sm">
        Keep it after all
      </Button>
    ),
  },
};
