import "@/app/globals.css";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { NewPlanForm } from "./NewPlanForm";

/**
 * promise: a-plan-starts-as-a-conversation — brief-as-the-contract A18.
 *
 * The page for starting a plan asks for no name and no type before the
 * conversation begins; the name is proposed once the plan is clear.
 *
 * (workbench-plan-authoring A9 — a workbench wrapping several repos asks which
 * repo the plan's code goes in — moved with the name: it is asked where the
 * name is accepted, in `DraftProposal.test.tsx`.)
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("A18 — starting a plan asks for no name and no type first", () => {
  it("the entry offers neither a name nor a type before the conversation begins", async () => {
    const screen = await render(<NewPlanForm project="concierge" />);
    expect(screen.getByPlaceholder("kebab-case-name").elements()).toHaveLength(
      0,
    );
    expect(screen.getByLabelText("Name").elements()).toHaveLength(0);
    expect(screen.getByLabelText("Type").elements()).toHaveLength(0);
  });
});
