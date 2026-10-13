import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AmendmentCard } from "./AmendmentCard";
import { Button } from "./Button";

const meta = {
  title: "ui/AmendmentCard",
  component: AmendmentCard,
} satisfies Meta<typeof AmendmentCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  args: {
    title: "A promise changed during the build",
    changes: [
      {
        name: "a-look-has-the-plan-that-owns-it",
        was: "Every look has a plan.",
        now: "Every approved look records the plan that made or last changed it.",
      },
    ],
    children: <Button>Approve</Button>,
  },
};
