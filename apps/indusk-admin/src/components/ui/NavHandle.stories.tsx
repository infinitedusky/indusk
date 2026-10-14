import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NavHandle } from "./NavHandle";

// The nav's edge in its column: the handle sits on the column's right border,
// beside the page it would narrow.
const meta = {
  title: "ui/NavHandle",
  component: NavHandle,
  decorators: [
    (Story) => (
      <div className="m-6 grid h-input cols-shell overflow-hidden rounded-xl border border-line">
        <div className="relative border-r border-line bg-surface">
          <Story />
        </div>
        <div className="bg-ground" />
      </div>
    ),
  ],
} satisfies Meta<typeof NavHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 280, min: 280, max: 440 },
};
// Held by a pointer: the line and the grip in the dusk colour.
export const Dragging: Story = {
  args: { value: 440, min: 280, max: 440, dragging: true },
};
