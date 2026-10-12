import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Timeline } from "./Timeline";

const meta = {
  title: "ui/Timeline",
  component: Timeline,
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { when: "14:02", what: "Broken: --color-dusk", tone: "bad" },
      { when: "11:40", what: "Held", tone: "good" },
      { when: "Mon", what: "Declared in ui-promises" },
    ],
  },
};
