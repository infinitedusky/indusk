import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PromiseRow } from "./PromiseRow";

const meta = {
  title: "ui/PromiseRow",
  component: PromiseRow,
} satisfies Meta<typeof PromiseRow>;

export default meta;
type Story = StoryObj<typeof meta>;

const base = {
  says: "A token changed in the app alone shows broken on the dashboard",
  slug: "tokens-are-held-exactly",
  pips: ["passing", "passing", "written"],
  evals: "3 of 4 held",
  last: "2h ago",
} as const;

export const Broken: Story = { args: { ...base, standing: "broken" } };
export const Proving: Story = {
  args: { ...base, standing: "proving", evals: "no evals yet", last: "1d ago" },
};
export const Enforced: Story = {
  args: {
    ...base,
    standing: "enforced",
    evals: "12 of 12 held",
    last: "3d ago",
  },
};
export const Declared: Story = {
  args: {
    ...base,
    standing: "declared",
    pips: ["planned"],
    evals: "no evals yet",
    last: "never",
  },
};
export const Empty: Story = {
  args: {
    ...base,
    standing: "declared",
    empty: "No promises declared yet. A plan declares them in its brief.",
  },
};
