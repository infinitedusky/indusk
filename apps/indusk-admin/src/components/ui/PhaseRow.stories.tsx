import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PhaseItems } from "../plan/PhaseItems";
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
      <PhaseItems
        items={[
          {
            checked: true,
            text: "Draw the mockups for the looks the brief already lists",
            note: "Six screen mockups drawn; three new components each drawn as their own mockup per state.",
          },
          { checked: false, text: "The page draws the approved layout" },
        ]}
      />
    ),
  },
} satisfies Meta<typeof PhaseRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

/** An open phase: its paragraph, then each task as a sentence with a closed Technical fold. */
export const Open: Story = {
  args: {
    open: true,
    name: "Build Phase 1: Compose fills content",
    count: "1 of 3",
    summary:
      'Today a placed button always shows its story\'s words. After this phase, a mockup can hand it "Create project" and the button shows those words instead. Phase 2 then teaches the stories where words can go, and Phase 3 stops anything but words from going in.',
    children: (
      <PhaseItems
        items={[
          {
            checked: true,
            text: "A snapshot remembers where its words sit",
            detail:
              "A snapshot gains a content map: each slot name to the paths of the text nodes it fills.",
          },
          {
            checked: false,
            text: "Placing a component puts your words in place of the story's",
            detail:
              "Each slot's paths are walked and the text node is replaced with the mockup's value.\n\n```ts\ncompose(snapshot, { title: \"Create project\" })\n```",
          },
        ]}
      />
    ),
  },
};
