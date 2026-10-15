import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeviceFrame } from "./DeviceFrame";

const meta = {
  title: "ui/DeviceFrame",
  component: DeviceFrame,
} satisfies Meta<typeof DeviceFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "dashboard.default at phone · 390 × 844" },
};
