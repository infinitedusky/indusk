import type {
  AppLooks,
  AppLooksRead,
  LooksCheckout,
  MockupView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { APPROVAL_STYLE } from "@/components/bars/labels";
import { stamp } from "@/lib/stamp";
import { ApproveMockup } from "./ApproveMockup";
import { ApproveSelected } from "./ApproveSelected";
import { Components, type OpenStory, OpenStoryView } from "./Stories";

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
  checkout = null,
  checkouts = [],
}: {
  project: string;
  apps: AppLooksRead[];
  /** The page's own path, for the device links. */
  path: string;
  open: OpenMockup | null;
  /** The story open in its frame, when one is. */
  openStory?: OpenStory | null;
  /** The plan whose worktree is read; null for the project's own checkout. */
  checkout?: string | null;
  /** Every checkout that can be read; a switch is shown when there is more than one. */
  checkouts?: LooksCheckout[];
}) {
  return (
    <section
      className="flex flex-col gap-6"
      data-testid="looks"
      data-look-state={lookState(apps)}
    >
      <h1 className="text-xl font-semibold text-ink">Looks</h1>
      {checkouts.length > 1 ? (
        <nav
          className="flex flex-wrap items-center gap-2 text-sm text-ink-soft"
          data-testid="looks-checkouts"
          aria-label="Checkout"
        >
          <span>Reading</span>
          {checkouts.map((c) => (
            <a
              key={c.plan ?? "own"}
              href={
                c.plan ? `${path}?checkout=${encodeURIComponent(c.plan)}` : path
              }
              aria-current={c.plan === checkout ? "page" : undefined}
              title={c.branch ?? undefined}
              className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
            >
              {c.plan ?? "this checkout"}
            </a>
          ))}
        </nav>
      ) : null}
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
}: {
  project: string;
  app: AppLooks;
  path: string;
  checkout: string | null;
  open: OpenMockup | null;
  openStory: OpenStory | null;
}) {
  const opened = open
    ? (app.mockups.find((m) => m.name === open.mockup) ?? null)
    : null;
  const device = open
    ? (app.devices.find((d) => d.name === open.device) ?? null)
    : null;
  const story = openStory
    ? (app.stories.find((s) => s.name === openStory.story) ?? null)
    : null;
  const storyDevice = openStory
    ? (app.devices.find((d) => d.name === openStory.device) ?? null)
    : null;
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
        proposed={app.mockups.filter((m) => m.approval === "proposed").length}
      />
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {app.mockups.map((m) => (
          <MockupRow
            key={m.name}
            app={app}
            mockup={m}
            path={path}
            checkout={checkout}
            current={opened?.name === m.name ? (device?.name ?? null) : null}
          />
        ))}
      </ul>
      {opened && device ? (
        <OpenMockupView
          project={project}
          app={app}
          mockup={opened}
          device={device}
          checkout={checkout}
        />
      ) : null}
      <Components
        app={app}
        path={path}
        checkout={checkout}
        current={
          story && storyDevice
            ? { story: story.name, device: storyDevice.name }
            : null
        }
      />
      {story && storyDevice ? (
        <OpenStoryView
          project={project}
          app={app}
          story={story}
          device={storyDevice}
          checkout={checkout}
        />
      ) : null}
      <Uncovered app={app} />
    </section>
  );
}

/** One mockup open at one device: its name and size, Approve when it is proposed, and the frame. */
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
        <span>
          {device.name} · {device.width} × {device.height}
        </span>
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
        ) : null}
      </div>
      <div className="max-w-full overflow-auto">
        <iframe
          data-testid="mockup-frame"
          data-component="device-frame"
          title={`${mockup.name} at ${device.name}`}
          srcDoc={mockup.document}
          width={device.width}
          height={device.height}
          sandbox=""
          className="block border-0 bg-surface elevated"
        />
      </div>
    </section>
  );
}

function MockupRow({
  app,
  mockup,
  path,
  checkout,
  current,
}: {
  app: AppLooks;
  mockup: MockupView;
  path: string;
  checkout: string | null;
  /** The device it is open at, when it is the open mockup. */
  current: string | null;
}) {
  const hrefAt = (device: string) =>
    `${path}?${new URLSearchParams({
      app: app.app,
      mockup: mockup.name,
      device,
      ...(checkout ? { checkout } : {}),
    })}`;
  return (
    <li
      data-testid="mockup-row"
      data-component="look-row"
      data-mockup={mockup.name}
      data-approval={mockup.approval}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
    >
      {mockup.approval === "proposed" ? (
        <input
          type="checkbox"
          value={mockup.name}
          data-select-mockup=""
          data-mockup-hash={mockup.hash}
          data-components-hash={mockup.componentsHash}
          aria-label={`Select ${mockup.name}`}
        />
      ) : null}
      <span className="font-medium text-ink">{mockup.name}</span>
      <span
        className={`rounded-md border px-tight text-xs ${APPROVAL_STYLE[mockup.approval]}`}
      >
        {mockup.approval}
      </span>
      {mockup.componentsChanged.length > 0 ? (
        <span className="text-xs text-warn" data-testid="components-changed">
          component changed: {mockup.componentsChanged.join(", ")}
        </span>
      ) : null}
      {mockup.approval === "approved" && mockup.entry ? (
        <span className="text-xs text-ink-faint">
          by {mockup.entry.by}, {stamp(mockup.entry.at)}
        </span>
      ) : null}
      <span data-component="device-choice" className="ml-auto flex gap-2">
        {app.devices.map((d) => (
          <a
            key={d.name}
            href={hrefAt(d.name)}
            data-testid="device-link"
            data-device={d.name}
            aria-current={current === d.name ? "page" : undefined}
            className="rounded-md px-tight text-xs text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
          >
            {d.name}
          </a>
        ))}
      </span>
    </li>
  );
}

function Uncovered({ app }: { app: AppLooks }) {
  const items = [
    ...app.uncovered.screens.map((name) => ({ kind: "screen", name })),
    ...app.uncovered.states.map((name) => ({ kind: "state", name })),
    ...app.uncovered.components.map((name) => ({ kind: "component", name })),
    // A story no person has approved as its snapshot is now, and a state a
    // mockup shows that has no story at all.
    ...app.uncovered.stories.map((name) => ({ kind: "story", name })),
    ...app.uncovered.noStory.map((name) => ({ kind: "no story", name })),
    // A component named at run time, by where the source names it.
    ...app.uncovered.unresolved.map((name) => ({ kind: "unresolved", name })),
  ];
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
