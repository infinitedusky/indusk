import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Message } from "./Message";

const meta = {
  title: "ui/Message",
  component: Message,
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const You: Story = {
  args: {
    state: "you",
    children: (
      <p>
        A parental control system for desktop and mobile that works with the
        child on homework.
      </p>
    ),
    documents: ["Homework Gate Project Brief.md"],
  },
};
export const Agent: Story = {
  args: {
    state: "agent",
    children: (
      <>
        <p>Your brief answers why and what. Three things it leaves open:</p>
        <ol>
          <li>Is mobile a phone app that enforces the lock?</li>
          <li>Where should the server run?</li>
          <li>Name and place?</li>
        </ol>
      </>
    ),
  },
};

const reply = (
  <>
    <p>
      Your brief answers <strong>why</strong> and <strong>what</strong>. Three
      things it leaves open:
    </p>
    <ol>
      <li>Is mobile a phone app that enforces the lock?</li>
      <li>Where should the server run?</li>
      <li>Name and place?</li>
    </ol>
  </>
);

/** The agent's reply with its working hidden behind "See more ›". */
export const AgentFolded: Story = {
  args: {
    state: "agent-folded",
    working: ["Read planner.md"],
    children: reply,
  },
};

/** The same reply with its working shown above it, and "See less". */
export const AgentOpen: Story = {
  args: {
    state: "agent-open",
    working: [
      "Read planner.md",
      "Read documents/Homework Gate Project Brief.md",
      "Wrote knowledge.json — why settled, what settled",
    ],
    children: reply,
  },
};

/** The agent is still making its reply: the pulsing dot and "Working…". */
export const AgentWorking: Story = {
  args: {
    state: "agent-working",
    working: ["Read planner.md"],
    children: null,
  },
};

/** The agent ended before replying: the grey dot and the line that says how to go on. */
export const AgentStopped: Story = {
  args: {
    state: "agent-stopped",
    working: ["Read planner.md"],
    children: null,
  },
};
