import type {
  MockupView,
  StoryView,
} from "@infinitedusky/indusk-mcp/looks/overview";

/**
 * The checkbox beside a proposed look, carrying the hashes the page drew it at
 * (`data-select-mockup` or `data-select-story`): `ApproveSelected` reads the
 * ticked boxes from the page and sends those hashes, so the attributes are its
 * whole contract with the rows. One component for the list rows and the
 * cascade, mockups and stories alike.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export function SelectBox(
  props: { mockup: MockupView } | { story: StoryView },
) {
  if ("mockup" in props) {
    const m = props.mockup;
    return (
      <input
        type="checkbox"
        value={m.name}
        data-select-mockup=""
        data-mockup-hash={m.hash}
        data-components-hash={m.componentsHash}
        aria-label={`Select ${m.name}`}
      />
    );
  }
  const s = props.story;
  return (
    <input
      type="checkbox"
      value={s.name}
      data-select-story=""
      data-snapshot-hash={s.hash}
      data-stylesheet-hash={s.stylesheetHash ?? ""}
      aria-label={`Select ${s.name}`}
    />
  );
}
