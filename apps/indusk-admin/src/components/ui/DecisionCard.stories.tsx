import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { DecisionCard } from "./DecisionCard";

const meta = {
  title: "ui/DecisionCard",
  component: DecisionCard,
} satisfies Meta<typeof DecisionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ask: Story = {
  args: {
    tone: "ask",
    who: { label: "Waiting for you at Review", state: "ask" },
    title: "Approve the cockpit mockups?",
    children: (
      <>
        <p>
          Eleven mockups are drawn on the foundation with no raw value. Open
          each at every device and approve it.
        </p>
        <div className="flex flex-wrap gap-snug">
          <Button variant="primary">Approve</Button>
          <Button variant="secondary">Not yet</Button>
        </div>
      </>
    ),
  },
};
export const Working: Story = {
  args: {
    tone: "info",
    who: { label: "Claude is working", state: "busy" },
    title: "Building · 2 of 5",
    children: (
      <ul className="grid list-none gap-2 text-md leading-4 text-ink-soft">
        <li className="text-ok">✓ Build Phase 1 — the foundation</li>
        <li className="text-dusk">● Build Phase 3 — the running app</li>
        <li className="text-idle">○ Build Phase 4 — looks in the cockpit</li>
      </ul>
    ),
  },
};
/** A plan merged to main: complete, with what is still to be confirmed (a-run-can-be-trusted). */
export const Complete: Story = {
  args: {
    tone: "info",
    who: { label: "Complete", state: "ok" },
    title: "Complete — merged to main",
    children: (
      <ul className="grid list-none gap-2 text-md leading-4 text-ink-soft">
        <li className="text-ok">✓ main-is-merged-first — clause signal</li>
        <li className="text-ok">✓ the-person-never-merges — clause signal</li>
        <li className="text-idle">○ a-conflict-refuses — clause signal</li>
        <li className="text-idle">○ L2 — live check</li>
      </ul>
    ),
  },
};
export const Released: Story = {
  args: {
    tone: "info",
    who: { label: "Released", state: "ok" },
    title: "Released",
    children: <p>Merged to main. Its promises are watched in use.</p>,
  },
};
export const Alert: Story = {
  args: {
    tone: "alert",
    children: (
      <>
        <p>
          The check at 14:02 found <b>--color-dusk</b> approved as #c2620b and
          actual #d07020 on the dashboard at desktop.
        </p>
        <div className="flex flex-wrap items-center gap-snug text-sm leading-3 text-ink-faint">
          <Button variant="primary">Fix with Claude</Button>
          <span>Broken 2 hours ago</span>
        </div>
      </>
    ),
  },
};
