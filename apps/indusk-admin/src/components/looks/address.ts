/**
 * The Looks page's address and its choices: what is shown, how, and which
 * checkout is read. One function builds every link, so a choice survives
 * choosing another.
 */

/**
 * Which looks the page draws: only mockups, only components, or both — and
 * `unapproved` draws both, only the ones no person has approved as they are
 * now (proposed, or withdrawn by a person).
 */
export type Show = "all" | "unapproved" | "mockups" | "components";

/** The `?show=` a request carries, read as a `Show`; anything else is `all`. */
export function showOf(value: string | undefined): Show {
  return value === "mockups" || value === "components" || value === "unapproved"
    ? value
    : "all";
}

/** The looks a list draws: the ones waiting for a person first; with `unapproved`, only those. */
export function looksListed<T extends { approval: "approved" | "proposed" }>(
  looks: T[],
  show: Show,
): T[] {
  const waiting = looks.filter((l) => l.approval === "proposed");
  if (show === "unapproved") return waiting;
  return [...waiting, ...looks.filter((l) => l.approval !== "proposed")];
}

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
