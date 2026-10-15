import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Box } from "./Box";

const meta = {
  title: "ui/Box",
  component: Box,
} satisfies Meta<typeof Box>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Where it lives",
    children: <p className="text-sm leading-3">Plan ui-promises · state</p>,
  },
};
