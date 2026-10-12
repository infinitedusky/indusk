import type {
  AppLooks,
  StoryView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { APPROVAL_STYLE } from "@/components/bars/labels";
import { stamp } from "@/lib/stamp";
import { ApproveStory } from "./ApproveMockup";

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

/** The story open at one device, from `?story=<name>&device=<device>`. */
export interface OpenStory {
  app: string;
  story: string;
  device: string;
}

/** Where a story is served from: the admin's own static Storybook build. */
export const storyFrameSrc = (id: string): string =>
  `/storybook/iframe.html?${new URLSearchParams({ id, viewMode: "story" })}`;

/** `changed` is a story approved once whose snapshot has since differed. */
const label = (s: StoryView): "approved" | "proposed" | "changed" =>
  s.approval === "approved" ? "approved" : s.entry ? "changed" : "proposed";

function byComponent(stories: StoryView[]): Array<[string, StoryView[]]> {
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
  current,
}: {
  app: AppLooks;
  path: string;
  checkout: string | null;
  /** The story and device open, when one is. */
  current: { story: string; device: string } | null;
}) {
  if (app.stories.length === 0) return null;
  const hrefAt = (story: string, device: string) =>
    `${path}?${new URLSearchParams({
      app: app.app,
      story,
      device,
      ...(checkout ? { checkout } : {}),
    })}`;
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
                  current={current?.story === s.name ? current.device : null}
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
  hrefAt: (story: string, device: string) => string;
  current: string | null;
}) {
  const state = label(story);
  return (
    <li
      data-testid="story-row"
      data-story={story.name}
      data-approval={story.approval}
      data-state={state}
      className="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <span className="text-ink">{story.state}</span>
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
      {story.id ? (
        <span className="ml-auto flex gap-2">
          {app.devices.map((d) => (
            <a
              key={d.name}
              href={hrefAt(story.name, d.name)}
              data-testid="story-device-link"
              data-device={d.name}
              aria-current={current === d.name ? "page" : undefined}
              className="rounded-md px-tight text-xs text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
            >
              {d.name}
            </a>
          ))}
        </span>
      ) : (
        <span className="ml-auto text-xs text-warn">
          no Storybook id — run indusk looks stories {app.app}
        </span>
      )}
    </li>
  );
}

/** One story open at one device: its name and size, Approve unless it is approved, and the frame. */
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
  device: AppLooks["devices"][number];
  checkout: string | null;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="story-open">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span className="font-medium">{story.name}</span>
        <span>
          {device.name} · {device.width} × {device.height}
        </span>
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
      <div className="max-w-full overflow-auto">
        {story.id ? (
          <iframe
            data-testid="story-frame"
            title={`${story.name} at ${device.name}`}
            src={storyFrameSrc(story.id)}
            width={device.width}
            height={device.height}
            className="block border-0 bg-surface elevated"
          />
        ) : null}
      </div>
    </section>
  );
}
