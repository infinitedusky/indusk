import type { AppLooks } from "@infinitedusky/indusk-mcp/looks/overview";
import { APPROVAL_STYLE } from "@/components/bars/labels";
import { stamp } from "@/lib/stamp";
import { ApproveMockup, ApproveStory } from "./ApproveMockup";
import { LookFrame } from "./LookFrame";
import { byComponent, storyFrameSrc, storyLabel } from "./Stories";

/**
 * The cascade view (storybook-components ADR decision 6): every mockup and
 * every component's stories drawn one after another, each at its own size with
 * the reference devices to choose from, and Approve beside the thing itself.
 * The same facts as the list and its stage (`looks/overview`); only the
 * arrangement differs.
 *
 * promise: mockups-render-in-the-cockpit
 */
export function Cascade({
  project,
  app,
  checkout,
  mockups,
  components,
}: {
  project: string;
  app: AppLooks;
  checkout: string | null;
  /** Draw the mockups. */
  mockups: boolean;
  /** Draw the components' stories. */
  components: boolean;
}) {
  // A mockup is a whole screen: it opens at the largest device.
  const mockupDevice = [...app.devices].sort((a, b) => b.width - a.width)[0];
  return (
    <div className="flex flex-col gap-8" data-testid="cascade">
      {mockups ? (
        <section className="flex flex-col gap-6" data-testid="cascade-mockups">
          <h3 className="text-sm font-semibold text-ink-soft">Looks</h3>
          {app.mockups.map((m) => (
            <article
              key={m.name}
              className="flex flex-col gap-2"
              data-testid="cascade-item"
              data-mockup={m.name}
              data-approval={m.approval}
            >
              <header className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-ink">{m.name}</span>
                <span
                  className={`rounded-md border px-tight text-xs ${APPROVAL_STYLE[m.approval]}`}
                >
                  {m.approval}
                </span>
                {m.componentsChanged.length > 0 ? (
                  <span className="text-xs text-warn">
                    component changed: {m.componentsChanged.join(", ")}
                  </span>
                ) : null}
                {m.approval === "approved" && m.entry ? (
                  <span className="text-xs text-ink-faint">
                    by {m.entry.by}, {stamp(m.entry.at)}
                  </span>
                ) : null}
                {m.approval === "proposed" ? (
                  <ApproveMockup
                    project={project}
                    app={app.app}
                    mockup={m.name}
                    mockupHash={m.hash}
                    componentsHash={m.componentsHash}
                    foundationHash={app.foundationHash}
                    checkout={checkout}
                  />
                ) : null}
              </header>
              <LookFrame
                testId="mockup-frame"
                title={m.name}
                srcDoc={m.document}
                devices={app.devices}
                initialDevice={mockupDevice?.name ?? null}
              />
            </article>
          ))}
        </section>
      ) : null}
      {components && app.stories.length > 0 ? (
        <section
          className="flex flex-col gap-6"
          data-testid="cascade-components"
        >
          <h3 className="text-sm font-semibold text-ink-soft">Components</h3>
          {byComponent(app.stories).map(([component, stories]) => (
            <div
              key={component}
              className="flex flex-col gap-4"
              data-testid="cascade-component"
              data-name={component}
            >
              <h4 className="text-sm font-medium text-ink">{component}</h4>
              {stories.map((s) => (
                <article
                  key={s.name}
                  className="flex flex-col gap-2"
                  data-testid="cascade-item"
                  data-story={s.name}
                  data-state={storyLabel(s)}
                >
                  <header className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-ink">{s.state}</span>
                    <span
                      className={`rounded-md border px-tight text-xs ${APPROVAL_STYLE[s.approval]}`}
                    >
                      {storyLabel(s)}
                    </span>
                    {s.approval === "approved" && s.entry ? (
                      <span className="text-xs text-ink-faint">
                        by {s.entry.by}, {stamp(s.entry.at)}
                      </span>
                    ) : null}
                    {s.approval === "proposed" ? (
                      <ApproveStory
                        project={project}
                        app={app.app}
                        story={s.name}
                        snapshotHash={s.hash}
                        foundationHash={app.foundationHash}
                        checkout={checkout}
                      />
                    ) : null}
                  </header>
                  {s.id ? (
                    <LookFrame
                      testId="story-frame"
                      title={s.name}
                      src={storyFrameSrc(s.id)}
                      devices={app.devices}
                      initialDevice={null}
                    />
                  ) : (
                    <p className="text-xs text-warn">
                      no Storybook id — run indusk looks stories {app.app}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
