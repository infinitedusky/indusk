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
const FOLD = "mt-hair text-xs leading-2 text-ink-faint cursor-pointer";
const FOLD_BODY =
  "mt-2 grid gap-2 rounded-md border border-line bg-surface px-3 py-2 text-xs leading-2 text-ink-soft";

/** An open phase: its paragraph, then each task as a sentence with a closed Technical fold. */
export const Open: Story = {
  args: {
    open: true,
    name: "Build Phase 1: Compose fills content",
    count: "1 of 3",
    summary:
      'Today a placed button always shows its story\'s words. After this phase, a mockup can hand it "Create project" and the button shows those words instead. Phase 2 then teaches the stories where words can go, and Phase 3 stops anything but words from going in.',
    children: (
      <ul className="grid list-none gap-2">
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-sm leading-3 text-ink-soft">☑</span>
          <div className="min-w-0">
            <div className="text-sm leading-3">
              A snapshot remembers where its words sit
            </div>
            <details>
              <summary className={FOLD}>Technical</summary>
              <div className={FOLD_BODY}>
                <div>
                  A snapshot gains a content map: each slot name to the paths of
                  the text nodes it fills.
                </div>
              </div>
            </details>
          </div>
        </li>
        <li className="flex items-baseline gap-2">
          <span className="font-mono text-sm leading-3 text-ink-soft">☐</span>
          <div className="min-w-0">
            <div className="text-sm leading-3">
              Placing a component puts your words in place of the story's
            </div>
            <details open>
              <summary className={FOLD}>Technical</summary>
              <div className={FOLD_BODY}>
                <div>
                  Each slot's paths are walked and the text node is replaced
                  with the mockup's value.
                </div>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-2 break-words">
                  compose(snapshot, {"{"} title: "Create project" {"}"})
                </pre>
              </div>
            </details>
          </div>
        </li>
      </ul>
    ),
  },
};
