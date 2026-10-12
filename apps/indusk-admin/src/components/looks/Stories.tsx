import type {
  AppLooks,
  StoryView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { APPROVAL_STYLE } from "@/components/bars/labels";
import { stamp } from "@/lib/stamp";
import { ApproveStory } from "./ApproveMockup";
import { hrefOf, type Show } from "./address";
import { LookFrame } from "./LookFrame";

/**
 * An app's components on the Looks page (storybook-components ADR decisions 3,
 * 5, 6): each component's stories by state — approved, proposed, or changed
 * (approved once, its snapshot differs now) — a link per reference device, and
 * the open story framed from the Storybook the admin itself serves at
 * `/storybook`: nothing runs beside the cockpit. Every fact is the package's
 * (`looks/overview`); this only draws it.
 *
 * promise: mockups-render-in-the-cockpit
 */

/** The story open, from `?story=<name>`; `device` is the width it opens at, else its own size. */
export interface OpenStory {
  app: string;
  story: string;
  device: string | null;
}

/** Where a story is served from: the admin's own static Storybook build. */
export const storyFrameSrc = (id: string): string =>
  `/storybook/iframe.html?${new URLSearchParams({ id, viewMode: "story" })}`;

/** `changed` is a story approved once whose snapshot has since differed. */
export const storyLabel = (
  s: StoryView,
): "approved" | "proposed" | "changed" =>
  s.approval === "approved" ? "approved" : s.entry ? "changed" : "proposed";

export function byComponent(
  stories: StoryView[],
): Array<[string, StoryView[]]> {
  const groups = new Map<string, StoryView[]>();
  for (const s of stories) {
    groups.set(s.component, [...(groups.get(s.component) ?? []), s]);
  }
  return [...groups];
}

export function Components({
  app,
  path,
  checkout,
  show,
  current,
}: {
  app: AppLooks;
  path: string;
  checkout: string | null;
  show: Show;
  /** The story open, when one is. */
  current: string | null;
}) {
  if (app.stories.length === 0) return null;
  const hrefAt = (story: string) =>
    hrefOf(path, { app: app.app, story, show, view: "list", checkout });
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="components"
      data-app={app.app}
    >
      <h3 className="text-sm font-semibold text-ink-soft">Components</h3>
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {byComponent(app.stories).map(([component, stories]) => (
          <li
            key={component}
            data-testid="component"
            data-name={component}
            className="flex flex-col gap-1 px-3 py-2 text-sm"
          >
            <span className="font-medium text-ink">{component}</span>
            <ul className="flex flex-col gap-1">
              {stories.map((s) => (
                <StoryRow
                  key={s.name}
                  app={app}
                  story={s}
                  hrefAt={hrefAt}
                  current={current === s.name}
                />
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StoryRow({
  app,
  story,
  hrefAt,
  current,
}: {
  app: AppLooks;
  story: StoryView;
  hrefAt: (story: string) => string;
  current: boolean;
}) {
  const state = storyLabel(story);
  return (
    <li
      data-testid="story-row"
      data-story={story.name}
      data-approval={story.approval}
      data-state={state}
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      {story.id ? (
        <a
          href={hrefAt(story.name)}
          data-testid="story-link"
          aria-current={current ? "page" : undefined}
          className="rounded-md text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
        >
          {story.state}
        </a>
      ) : (
        <span className="text-ink">{story.state}</span>
      )}
      <span
        className={`rounded-md border px-tight text-xs ${APPROVAL_STYLE[story.approval]}`}
      >
        {state}
      </span>
      {story.approval === "approved" && story.entry ? (
        <span className="text-xs text-ink-faint">
          by {story.entry.by}, {stamp(story.entry.at)}
        </span>
      ) : null}
      {story.id ? null : (
        <span className="ml-auto text-xs text-warn">
          no Storybook id — run indusk looks stories {app.app}
        </span>
      )}
    </li>
  );
}

/** One story open: its name, Approve unless it is approved, and the frame at its own size. */
export function OpenStoryView({
  project,
  app,
  story,
  device,
  checkout,
}: {
  project: string;
  app: AppLooks;
  story: StoryView;
  /** The device it opens at; null is the component's own size. */
  device: AppLooks["devices"][number] | null;
  checkout: string | null;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="story-open">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span className="font-medium">{story.name}</span>
        {story.approval === "proposed" ? (
          <ApproveStory
            project={project}
            app={app.app}
            story={story.name}
            snapshotHash={story.hash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        ) : null}
      </div>
      {story.id ? (
        <LookFrame
          testId="story-frame"
          title={story.name}
          src={storyFrameSrc(story.id)}
          devices={app.devices}
          initialDevice={device?.name ?? null}
        />
      ) : null}
    </section>
  );
}
