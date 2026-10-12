/**
 * The Looks page's address and its choices: what is shown, how, and which
 * checkout is read. One function builds every link, so a choice survives
 * choosing another.
 */

/** Which looks the page draws: only mockups, only components, or both. */
export type Show = "all" | "mockups" | "components";

/** The page's address with its choices kept: show, view and the checkout read. */
export function hrefOf(
  path: string,
  choices: {
    show: Show;
    view: "list" | "cascade";
    checkout: string | null;
    app?: string;
    mockup?: string;
    story?: string;
    device?: string;
  },
): string {
  const query = new URLSearchParams();
  if (choices.app) query.set("app", choices.app);
  if (choices.mockup) query.set("mockup", choices.mockup);
  if (choices.story) query.set("story", choices.story);
  if (choices.device) query.set("device", choices.device);
  if (choices.show !== "all") query.set("show", choices.show);
  if (choices.view !== "list") query.set("view", choices.view);
  if (choices.checkout) query.set("checkout", choices.checkout);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}
