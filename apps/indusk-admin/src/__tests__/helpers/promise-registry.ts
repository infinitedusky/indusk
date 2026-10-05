import { rmSync } from "node:fs";
import {
  type Registry,
  readPromises,
} from "@infinitedusky/indusk-mcp/promises/registry";
import {
  daysAgo,
  type IncidentSpec,
  promiseProject,
} from "../../../../indusk-mcp/src/__tests__/helpers/promises-fixture";

/**
 * A project holding one behaviour promise (and any incidents), read back as
 * the admin reads it — for the store and health-read unit tests (test-kinds).
 * No git, no Jaeger: the runs come from `fakeSource`.
 */

export const PROMISE = "checkout-never-charges-twice";
const OWNER = "checkout-v1";

export interface PromiseFixture {
  root: string;
  registry: Registry;
  cleanup(): void;
}

export function promiseRegistry(
  opts: { incidents?: IncidentSpec[]; production?: boolean } = {},
): PromiseFixture {
  const project = promiseProject({
    git: false,
    domains: ["checkout"],
    landed: { [OWNER]: daysAgo(30) },
    promises: [
      {
        name: PROMISE,
        kind: "behaviour",
        state: "enforced",
        domain: "checkout",
        owner: OWNER,
        sites: [`src/${PROMISE}.ts`],
        tests: [`src/${PROMISE}.test.ts`],
        ...(opts.incidents?.length
          ? { incidents: opts.incidents.map((i) => i.id) }
          : {}),
      },
    ],
    incidents: opts.incidents ?? [],
    ...(opts.production
      ? {
          extraConfig: {
            promises: {
              domains: ["checkout"],
              jaeger: {
                url: "http://production.test:16686",
                credential_env: "UNUSED_IN_UNIT_TESTS",
              },
            },
          },
        }
      : {}),
  });
  const read = readPromises(project.planRoot);
  if (!read.ok || !("registry" in read)) {
    throw new Error(`fixture registry did not read: ${JSON.stringify(read)}`);
  }
  return {
    root: project.root,
    registry: read.registry,
    cleanup: () => rmSync(project.root, { recursive: true, force: true }),
  };
}
