import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta = {
  title: "ui/Button",
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// `Default` is the mockups' plain button, `Yes` the answer a person is asked for.
export const Default: Story = {
  args: { variant: "secondary", children: "Not yet" },
};
export const Yes: Story = {
  args: { variant: "primary", children: "Approve" },
};
