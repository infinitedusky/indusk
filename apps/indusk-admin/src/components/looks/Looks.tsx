import type {
  AppLooks,
  AppLooksRead,
  MockupView,
} from "@infinitedusky/indusk-mcp/looks/overview";
import { APPROVAL_STYLE } from "@/components/bars/labels";
import { stamp } from "@/lib/stamp";
import { ApproveMockup } from "./ApproveMockup";

/**
 * The Looks page's body (ui-promises ADR decisions 2, 3, 5): each app's
 * mockups by name and approval, a link per reference device, and what no
 * approved mockup covers. Names and states first; a mockup's frame and its
 * Approve open one click at a time, from a device link. Every fact is the
 * package's (`looks/overview`); this only draws it.
 *
 * promise: mockups-render-in-the-cockpit
 */

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
}: {
  project: string;
  apps: AppLooksRead[];
  /** The page's own path, for the device links. */
  path: string;
  open: OpenMockup | null;
}) {
  return (
    <section className="flex flex-col gap-6" data-testid="looks">
      <h1 className="text-xl font-semibold text-gray-900">Looks</h1>
      {apps.length === 0 ? (
        <p className="text-sm text-gray-600" data-testid="looks-empty">
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
            className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            <span className="font-medium">{app.app}</span>: {app.problem}
          </div>
        ) : (
          <AppSection
            key={app.app}
            project={project}
            app={app}
            path={path}
            open={open?.app === app.app ? open : null}
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
  open,
}: {
  project: string;
  app: AppLooks;
  path: string;
  open: OpenMockup | null;
}) {
  const opened = open
    ? (app.mockups.find((m) => m.name === open.mockup) ?? null)
    : null;
  const device = open
    ? (app.devices.find((d) => d.name === open.device) ?? null)
    : null;
  return (
    <section
      className="flex flex-col gap-3"
      data-testid="looks-app"
      data-app={app.app}
    >
      <h2 className="text-base font-semibold text-gray-900">{app.app}</h2>
      <ul className="flex flex-col divide-y divide-gray-100 rounded border border-gray-200">
        {app.mockups.map((m) => (
          <MockupRow
            key={m.name}
            app={app}
            mockup={m}
            path={path}
            current={opened?.name === m.name ? (device?.name ?? null) : null}
          />
        ))}
      </ul>
      {opened && device ? (
        <section className="flex flex-col gap-2" data-testid="mockup-open">
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
            <span className="font-medium">{opened.name}</span>
            <span>
              {device.name} · {device.width} × {device.height}
            </span>
            {opened.approval === "proposed" ? (
              <ApproveMockup
                project={project}
                app={app.app}
                mockup={opened.name}
                foundationHash={app.foundationHash}
              />
            ) : null}
          </div>
          <div className="max-w-full overflow-auto">
            <iframe
              data-testid="mockup-frame"
              title={`${opened.name} at ${device.name}`}
              srcDoc={opened.document}
              width={device.width}
              height={device.height}
              sandbox=""
              className="block border-0 bg-white shadow-sm"
            />
          </div>
        </section>
      ) : null}
      <Uncovered app={app} />
    </section>
  );
}

function MockupRow({
  app,
  mockup,
  path,
  current,
}: {
  app: AppLooks;
  mockup: MockupView;
  path: string;
  /** The device it is open at, when it is the open mockup. */
  current: string | null;
}) {
  const hrefAt = (device: string) =>
    `${path}?${new URLSearchParams({ app: app.app, mockup: mockup.name, device })}`;
  return (
    <li
      data-testid="mockup-row"
      data-mockup={mockup.name}
      data-approval={mockup.approval}
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
    >
      <span className="font-medium text-gray-900">{mockup.name}</span>
      <span
        className={`rounded border px-1.5 text-xs ${APPROVAL_STYLE[mockup.approval]}`}
      >
        {mockup.approval}
      </span>
      {mockup.approval === "approved" && mockup.entry ? (
        <span className="text-xs text-gray-500">
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
            className="rounded px-1.5 text-xs text-blue-700 hover:bg-blue-50 aria-[current=page]:bg-blue-100"
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
  ];
  return (
    <section className="flex flex-col gap-1" data-testid="uncovered">
      <h3 className="text-sm font-semibold text-gray-700">Uncovered</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">
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
              className="rounded border border-dashed border-amber-400 bg-amber-50 px-1.5 text-amber-900"
            >
              {i.kind} {i.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
