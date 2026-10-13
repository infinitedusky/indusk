import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PhaseRow } from "./PhaseRow";

const meta = {
  title: "ui/PhaseRow",
  component: PhaseRow,
  args: {
    name: "Build Phase 4",
    count: "8 of 12",
    state: "in progress",
    tone: "doing",
    children: (
      <ul className="grid list-none gap-2">
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-sm leading-3 text-ink-soft">☑</span>
          <div className="min-w-0">
            <div className="text-sm leading-3">
              Draw the mockups for the looks the brief already lists
            </div>
            <div className="mt-hair text-xs leading-2 text-ink-faint">
              Six screen mockups drawn; three new components each drawn as their
              own mockup per state.
            </div>
          </div>
        </li>
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-sm leading-3 text-ink-soft">☐</span>
          <div className="text-sm leading-3">
            The page draws the approved layout
          </div>
        </li>
      </ul>
    ),
  },
} satisfies Meta<typeof PhaseRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};
export const Open: Story = { args: { open: true } };
