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
