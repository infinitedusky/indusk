import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DeviceChoice } from "./DeviceChoice";

const meta = {
  title: "ui/DeviceChoice",
  component: DeviceChoice,
} satisfies Meta<typeof DeviceChoice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    devices: ["phone", "narrow laptop", "desktop"],
    value: "phone",
  },
};
