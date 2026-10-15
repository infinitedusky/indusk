import type { AppLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import type { Show } from "./address";

/** How many of the drawn looks await approval: the ones that carry a checkbox. */
export function proposedIn(app: AppLooks, show: Show): number {
  const mockups =
    show === "components"
      ? 0
      : app.mockups.filter((m) => m.approval === "proposed").length;
  const stories =
    show === "mockups"
      ? 0
      : app.stories.filter((s) => s.approval === "proposed").length;
  return mockups + stories;
}

export function Uncovered({ app, show }: { app: AppLooks; show: Show }) {
  const all = [
    ...app.uncovered.screens.map((name) => ({ kind: "screen", name })),
    ...app.uncovered.states.map((name) => ({ kind: "state", name })),
    ...app.uncovered.components.map((name) => ({ kind: "component", name })),
    // A story no person has approved as its snapshot is now, and a state a
    // mockup shows that has no story at all.
    ...app.uncovered.stories.map((name) => ({ kind: "story", name })),
    ...app.uncovered.noStory.map((name) => ({ kind: "no story", name })),
    // A component named at run time, by where the source names it.
    ...app.uncovered.unresolved.map((name) => ({ kind: "unresolved", name })),
    // A component a mockup names that no source file implements.
    ...app.uncovered.unimplemented.map((name) => ({
      kind: "unimplemented",
      name,
    })),
  ];
  // Screens and their states are the mockups' side; the rest are the components'.
  const ofMockups = (kind: string) => kind === "screen" || kind === "state";
  const items = all.filter(
    (i) =>
      show === "all" ||
      show === "unapproved" ||
      (show === "mockups" ? ofMockups(i.kind) : !ofMockups(i.kind)),
  );
  return (
    <section className="flex flex-col gap-1" data-testid="uncovered">
      <h3 className="text-sm font-semibold text-ink-soft">Uncovered</h3>
      {items.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Every declared screen, state and component has an approved mockup.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2 text-sm">
          {items.map((i) => (
            <li
              key={`${i.kind}:${i.name}`}
              data-testid="uncovered-item"
              data-kind={i.kind}
              data-name={i.name}
              className="rounded-md border border-dashed border-warn bg-warn-wash px-tight text-warn"
            >
              {i.kind} {i.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
