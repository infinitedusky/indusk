import type {
  AppLooks,
  AppLooksRead,
  CountedCheckout,
  MockupView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { LookRow } from "@/components/ui/LookRow";
import { stamp } from "@/lib/stamp";
import { ApproveMockup } from "./ApproveMockup";
import { ApproveSelected } from "./ApproveSelected";
import { hrefOf, looksListed, type Show } from "./address";
import { Cascade } from "./Cascade";
import { LookFrame } from "./LookFrame";
import { LooksToolbar } from "./LooksToolbar";
import { OpenLookRow } from "./OpenLookRow";
import { SelectBox } from "./SelectBox";
import { Components, type OpenStory, OpenStoryView } from "./Stories";
import { UnapproveMockup } from "./Unapprove";
import { proposedIn, Uncovered } from "./Uncovered";

/**
 * The Looks page's body (ui-promises ADR decisions 2, 3, 5): each app's
 * mockups by name and approval, a link per reference device, and what no
 * approved mockup covers. Names and states first; a mockup's frame and its
 * Approve open one click at a time, from a device link. Every fact is the
 * package's (`looks/overview`); this only draws it.
 *
 * promise: mockups-render-in-the-cockpit
 */

/**
 * Which of the Looks screen's declared states this page drew, for the look
 * check (`data-look-state`, ui-promises Build Phase 6): `looks.uncovered`
 * when any app lists an uncovered part, `looks.default` when every one is
 * covered. A page that cannot be read draws neither.
 */
function lookState(apps: AppLooksRead[]): string | undefined {
  const read = apps.filter((a): a is AppLooks => !("problem" in a));
  if (read.length !== apps.length) return undefined;
  const uncovered = read.some(
    (a) =>
      a.uncovered.screens.length +
        a.uncovered.states.length +
        a.uncovered.components.length +
        a.uncovered.stories.length +
        a.uncovered.unresolved.length >
      0,
  );
  return uncovered ? "looks.uncovered" : "looks.default";
}

export interface OpenMockup {
  app: string;
  mockup: string;
  device: string;
}

export function LooksBody({
  project,
  apps,
  path,
  open,
  openStory = null,
  view = "list",
  show = "all",
  checkout = null,
  checkouts = [],
  planTitles = {},
}: {
  /** Each plan worktree's plan by its title. */
  planTitles?: Record<string, string>;
  project: string;
  apps: AppLooksRead[];
  /** The page's own path, for the device links. */
  path: string;
  open: OpenMockup | null;
  /** The story open in its frame, when one is. */
  openStory?: OpenStory | null;
  /** `list` is the list beside a stage; `cascade` draws every look, one after another. */
  view?: "list" | "cascade";
  /** Which looks are drawn: mockups, components, or both. */
  show?: Show;
  /** The plan whose worktree is read; null for the project's own checkout. */
  checkout?: string | null;
  /** Every checkout that can be read; a switch is shown when there is more than one. */
  checkouts?: CountedCheckout[];
}) {
  return (
    <section
      className="looks-page flex flex-col gap-4 overflow-y-auto"
      data-testid="looks"
      data-look-state={lookState(apps)}
    >
      <h1 className="text-xl font-semibold text-ink">Looks</h1>
      <LooksToolbar
        path={path}
        show={show}
        view={view}
        checkout={checkout}
        checkouts={checkouts}
        planTitles={planTitles}
      />
      {apps.length === 0 ? (
        <p className="text-sm text-ink-soft" data-testid="looks-empty">
          No looks yet. An app&apos;s look lives in{" "}
          <code>.indusk/mockups/&lt;app&gt;/</code>: a foundation, its devices,
          its screens and a mockup per screen and state.
        </p>
      ) : null}
      {apps.map((app) =>
        "problem" in app ? (
          <div
            key={app.app}
            role="alert"
            data-testid="looks-problem"
            className="rounded-md border border-bad bg-bad-wash p-3 text-sm text-bad"
          >
            <span className="font-medium">{app.app}</span>: {app.problem}
          </div>
        ) : (
          <AppSection
            key={app.app}
            project={project}
            app={app}
            path={path}
            checkout={checkout}
            open={open?.app === app.app ? open : null}
            openStory={openStory?.app === app.app ? openStory : null}
            view={view}
            show={show}
          />
        ),
      )}
    </section>
  );
}

function AppSection({
  project,
  app,
  path,
  checkout,
  open,
  openStory,
  view,
  show,
}: {
  project: string;
  app: AppLooks;
  path: string;
  checkout: string | null;
  open: OpenMockup | null;
  openStory: OpenStory | null;
  view: "list" | "cascade";
  show: Show;
}) {
  const mockups = show !== "components";
  const components = show !== "mockups";
  const opened = open
    ? (app.mockups.find((m) => m.name === open.mockup) ?? null)
    : null;
  const device = open
    ? (app.devices.find((d) => d.name === open.device) ?? null)
    : null;
  const story = openStory
    ? (app.stories.find((s) => s.name === openStory.story) ?? null)
    : null;
  const storyDevice = openStory?.device
    ? (app.devices.find((d) => d.name === openStory.device) ?? null)
    : null;
  if (view === "cascade") {
    return (
      <section
        className="flex flex-col gap-3"
        data-testid="looks-app"
        data-app={app.app}
      >
        <h2 className="text-base font-semibold text-ink">{app.app}</h2>
        <ApproveSelected
          project={project}
          app={app.app}
          foundationHash={app.foundationHash}
          checkout={checkout}
          proposed={proposedIn(app, show)}
        />
        <Cascade
          project={project}
          app={app}
          checkout={checkout}
          mockups={mockups}
          components={components}
          show={show}
        />
        <Uncovered app={app} show={show} />
      </section>
    );
  }
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3"
      data-testid="looks-app"
      data-app={app.app}
    >
      <h2 className="text-base font-semibold text-ink">{app.app}</h2>
      <div className="looks-split grid min-h-0 flex-1 gap-4">
        <input
          type="checkbox"
          id={`looks-sheet-${app.app}`}
          className="looks-sheet-toggle"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div
          className="looks-list flex min-h-0 flex-col gap-3 overflow-y-auto"
          data-testid="looks-list"
        >
          <label
            htmlFor={`looks-sheet-${app.app}`}
            className="looks-sheet-handle text-sm font-medium"
          >
            Looks
          </label>
          <ApproveSelected
            project={project}
            app={app.app}
            foundationHash={app.foundationHash}
            checkout={checkout}
            proposed={proposedIn(app, show)}
          />
          {mockups ? (
            <div className="looks-rows shrink-0 overflow-hidden rounded-md border border-line bg-surface">
              {looksListed(app.mockups, show).map((m) => (
                <MockupRow
                  key={m.name}
                  project={project}
                  app={app}
                  mockup={m}
                  path={path}
                  checkout={checkout}
                  show={show}
                  current={
                    opened?.name === m.name ? (device?.name ?? null) : null
                  }
                />
              ))}
            </div>
          ) : null}
          {components ? (
            <Components
              project={project}
              app={app}
              path={path}
              checkout={checkout}
              show={show}
              current={story?.name ?? null}
            />
          ) : null}
          <Uncovered app={app} show={show} />
        </div>
        <div
          className="looks-stage flex min-h-0 flex-col gap-3 overflow-auto"
          data-testid="looks-stage"
        >
          {opened && device ? (
            <OpenMockupView
              project={project}
              app={app}
              mockup={opened}
              device={device}
              checkout={checkout}
            />
          ) : null}
          {story ? (
            <OpenStoryView
              project={project}
              app={app}
              story={story}
              device={storyDevice}
              checkout={checkout}
            />
          ) : null}
          {!(opened && device) && !story ? (
            <p className="text-sm text-ink-soft" data-testid="stage-empty">
              Choose a mockup or a story; it stays here while the list scrolls.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** One mockup open at one device: its name and size, Approve when it is proposed, Unapprove when it is approved, and the frame. */
function OpenMockupView({
  project,
  app,
  mockup,
  device,
  checkout,
}: {
  project: string;
  app: AppLooks;
  mockup: MockupView;
  device: AppLooks["devices"][number];
  checkout: string | null;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="mockup-open">
      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
        <span className="font-medium">{mockup.name}</span>
        {mockup.approval === "proposed" ? (
          <ApproveMockup
            project={project}
            app={app.app}
            mockup={mockup.name}
            mockupHash={mockup.hash}
            componentsHash={mockup.componentsHash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        ) : (
          <UnapproveMockup
            project={project}
            app={app.app}
            mockup={mockup.name}
            mockupHash={mockup.hash}
            componentsHash={mockup.componentsHash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        )}
      </div>
      <LookFrame
        testId="mockup-frame"
        title={mockup.name}
        srcDoc={mockup.document}
        devices={app.devices}
        initialDevice={device.name}
      />
    </section>
  );
}

/** One mockup in the list: a `LookRow` for its name, chip and Open, then what a person does with it — select it, take its approval back, open it at a device. */
function MockupRow({
  project,
  app,
  mockup,
  path,
  checkout,
  show,
  current,
}: {
  project: string;
  app: AppLooks;
  mockup: MockupView;
  path: string;
  checkout: string | null;
  show: Show;
  /** The device it is open at, when it is the open mockup. */
  current: string | null;
}) {
  const hrefAt = (device: string) =>
    hrefOf(path, {
      app: app.app,
      mockup: mockup.name,
      device,
      show,
      view: "list",
      checkout,
    });
  const first = app.devices[0];
  return (
    <div
      data-testid="mockup-row"
      data-mockup={mockup.name}
      data-approval={mockup.approval}
      className="border-t border-line first:border-t-0"
    >
      {first ? (
        <OpenLookRow
          kind="mockup"
          name={mockup.name}
          approval={mockup.approval}
          href={hrefAt(first.name)}
        />
      ) : (
        <LookRow kind="mockup" name={mockup.name} approval={mockup.approval} />
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-3 text-xs text-ink-soft">
        {mockup.approval === "proposed" ? <SelectBox mockup={mockup} /> : null}
        {mockup.componentsChanged.length > 0 ? (
          <span className="text-warn" data-testid="components-changed">
            component changed: {mockup.componentsChanged.join(", ")}
          </span>
        ) : null}
        {mockup.approval === "approved" && mockup.entry ? (
          <span className="text-ink-faint">
            by {mockup.entry.by}, {stamp(mockup.entry.at)}
          </span>
        ) : null}
        {mockup.approval === "approved" ? (
          <UnapproveMockup
            project={project}
            app={app.app}
            mockup={mockup.name}
            mockupHash={mockup.hash}
            componentsHash={mockup.componentsHash}
            foundationHash={app.foundationHash}
            checkout={checkout}
          />
        ) : null}
        <span className="ml-auto flex gap-2">
          {app.devices.map((d) => (
            <a
              key={d.name}
              href={hrefAt(d.name)}
              data-testid="device-link"
              data-device={d.name}
              aria-current={current === d.name ? "page" : undefined}
              className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
            >
              {d.name}
            </a>
          ))}
        </span>
      </div>
    </div>
  );
}
