import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("a plan's mark in the nav", () => {
  it("is the first letter of its first two words", () => {
    expect(initialsOf("ui-promises")).toBe("UP");
    expect(initialsOf("browser-template-claims")).toBe("BT");
  });
  it("is its first two letters when it is one word", () => {
    expect(initialsOf("cleanup")).toBe("CL");
  });
  it("is a question mark for a name with no letters", () => {
    expect(initialsOf("--")).toBe("?");
  });
});
