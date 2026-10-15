import type {
  AppLooks,
  StoryView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { stamp } from "@/lib/stamp";
import { ApproveStory } from "./ApproveMockup";
import { hrefOf, looksListed, type Show } from "./address";
import { LookFrame } from "./LookFrame";
import { OpenLookRow } from "./OpenLookRow";
import { SelectBox } from "./SelectBox";
import { UnapproveStory } from "./Unapprove";

/**
 * An app's components on the Looks page (storybook-components ADR decisions 3,
 * 5, 6): each component's stories by state — approved, proposed, or changed
 * (approved once, its snapshot differs now) — a link per reference device, and
 * the open story framed from its snapshot as the selected checkout holds it
 * (`StoryView.document`), the bytes its Approve's hashes were read from: the
 * admin's own `/storybook` build stays for browsing and for `indusk looks
 * check` (Build Phase 9, A35). Every fact is the package's (`looks/overview`);
 * this only draws it.
 *
 * promise: mockups-render-in-the-cockpit
 */

/** The story open, from `?story=<name>`; `device` is the width it opens at, else its own size. */
export interface OpenStory {
  app: string;
  story: string;
  device: string | null;
}

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
  project,
  app,
  path,
  checkout,
  show,
  current,
}: {
  project: string;
  app: AppLooks;
  path: string;
  checkout: string | null;
  show: Show;
  /** The story open, when one is. */
  current: string | null;
}) {
  const stories = looksListed(app.stories, show);
  if (stories.length === 0) return null;
  const hrefAt = (story: string) =>
    hrefOf(path, { app: app.app, story, show, view: "list", checkout });
  return (
    <section
      className="flex flex-col gap-2"
      data-testid="components"
      data-app={app.app}
    >
      <h3 className="text-sm font-semibold text-ink-soft">Components</h3>
      <div className="looks-rows shrink-0 overflow-hidden rounded-md border border-line bg-surface">
        {byComponent(stories).map(([component, ofComponent]) => (
          <div
            key={component}
            data-testid="component"
            data-name={component}
            className="border-t border-line first:border-t-0"
          >
            <span className="block px-4 pt-3 text-sm font-medium text-ink">
              {component}
            </span>
            {ofComponent.map((s) => (
              <StoryRow
                key={s.name}
                project={project}
                checkout={checkout}
                app={app}
                story={s}
                hrefAt={hrefAt}
                current={current === s.name}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** One story in the list: a `LookRow` for its name, chip and Open, then what a person does with it. A story approved once and changed since reads proposed on the chip and `changed` here. */
function StoryRow({
  project,
  checkout,
  app,
  story,
  hrefAt,
  current,
}: {
  project: string;
  checkout: string | null;
  app: AppLooks;
  story: StoryView;
  hrefAt: (story: string) => string;
  current: boolean;
}) {
  const state = storyLabel(story);
  return (
    <div
      data-testid="story-row"
      data-story={story.name}
      data-approval={story.approval}
      data-state={state}
      className="border-t border-line first:border-t-0"
    >
      {/* Every story opens: its frame is its snapshot, which needs no Storybook id. */}
      <OpenLookRow
        kind="story"
        name={story.name}
        approval={story.approval}
        href={hrefAt(story.name)}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs text-ink-soft">
        {story.approval === "proposed" ? <SelectBox story={story} /> : null}
        <a
          href={hrefAt(story.name)}
          data-testid="story-link"
          aria-current={current ? "page" : undefined}
          className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
        >
          {story.state}
        </a>
        {state === "changed" ? (
          <span className="text-warn">changed since approved</span>
        ) : null}
        {story.approval === "approved" && story.entry ? (
          <span className="text-ink-faint">
            by {story.entry.by}, {stamp(story.entry.at)}
          </span>
        ) : null}
        {story.approval === "approved" ? (
          <UnapproveStory
            project={project}
            app={app.app}
            story={story.name}
            snapshotHash={story.hash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        ) : null}
        {story.id ? null : (
          <span className="ml-auto text-warn">
            no Storybook id, so not checked — run indusk looks stories {app.app}
          </span>
        )}
      </div>
    </div>
  );
}

/** One story open: its name, Approve while it is proposed, Unapprove once it is approved, and the frame at its own size. */
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
            stylesheetHash={story.stylesheetHash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        ) : (
          <UnapproveStory
            project={project}
            app={app.app}
            story={story.name}
            snapshotHash={story.hash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        )}
      </div>
      <LookFrame
        testId="story-frame"
        title={story.name}
        srcDoc={story.document}
        fitted
        devices={app.devices}
        initialDevice={device?.name ?? null}
      />
    </section>
  );
}
