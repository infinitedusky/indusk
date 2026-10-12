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
import { hrefOf, type Show } from "./address";
import { Cascade } from "./Cascade";
import { LookFrame } from "./LookFrame";
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

const SHOWS: Array<[Show, string]> = [
  ["all", "All"],
  ["mockups", "Mockups"],
  ["components", "Components"],
];

function Choice({
  label,
  testId,
  hint,
  children,
}: {
  label: string;
  testId: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      className="flex flex-wrap items-center gap-2 text-sm text-ink-soft"
      data-testid={testId}
      aria-label={label}
      title={hint}
    >
      <span>{label}</span>
      {children}
    </nav>
  );
}

function ChoiceLink({
  href,
  current,
  title,
  children,
}: {
  href: string;
  current: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      title={title}
      className="rounded-md px-tight text-dusk hover:bg-dusk-wash aria-[current=page]:bg-dusk-wash"
    >
      {children}
    </a>
  );
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
}: {
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
  checkouts?: LooksCheckout[];
}) {
  return (
    <section
      className="looks-page flex flex-col gap-4 overflow-y-auto"
      data-testid="looks"
      data-look-state={lookState(apps)}
    >
      <h1 className="text-xl font-semibold text-ink">Looks</h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Choice label="Show" testId="looks-show">
          {SHOWS.map(([value, text]) => (
            <ChoiceLink
              key={value}
              href={hrefOf(path, { show: value, view, checkout })}
              current={show === value}
            >
              {text}
            </ChoiceLink>
          ))}
        </Choice>
        <Choice label="View" testId="looks-views">
          {(["list", "cascade"] as const).map((v) => (
            <ChoiceLink
              key={v}
              href={hrefOf(path, { show, view: v, checkout })}
              current={view === v}
            >
              {v}
            </ChoiceLink>
          ))}
        </Choice>
        {checkouts.length > 1 ? (
          <Choice
            label="Read from"
            testId="looks-checkouts"
            hint="Which checkout's files are read: the project's own, or the worktree of a plan whose looks are being worked there. Not a filter — the same mockups and components are read from each."
          >
            {checkouts.map((c) => (
              <ChoiceLink
                key={c.plan ?? "own"}
                href={hrefOf(path, { show, view, checkout: c.plan })}
                current={c.plan === checkout}
                title={c.branch ?? undefined}
              >
                {c.plan
                  ? `plan ${c.plan}`
                  : `project checkout${c.branch ? ` (${c.branch})` : ""}`}
              </ChoiceLink>
            ))}
          </Choice>
        ) : null}
      </div>
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
        <Cascade
          project={project}
          app={app}
          checkout={checkout}
          mockups={mockups}
          components={components}
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
          {mockups ? (
            <>
              <ApproveSelected
                project={project}
                app={app.app}
                foundationHash={app.foundationHash}
                checkout={checkout}
                proposed={
                  app.mockups.filter((m) => m.approval === "proposed").length
                }
              />
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                {app.mockups.map((m) => (
                  <MockupRow
                    key={m.name}
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
              </ul>
            </>
          ) : null}
          {components ? (
            <Components
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

function MockupRow({
  app,
  mockup,
  path,
  checkout,
  show,
  current,
}: {
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
  return (
    <li
      data-testid="mockup-row"
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
      <span className="ml-auto flex gap-2">
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

function Uncovered({ app, show }: { app: AppLooks; show: Show }) {
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
  ];
  // Screens and their states are the mockups' side; the rest are the components'.
  const ofMockups = (kind: string) => kind === "screen" || kind === "state";
  const items = all.filter(
    (i) =>
      show === "all" ||
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
