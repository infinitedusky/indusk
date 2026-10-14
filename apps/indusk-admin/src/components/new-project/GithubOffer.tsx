"use client";

import type { Proposal } from "@infinitedusky/indusk-mcp/new-project";

const VISIBILITIES = [
  { value: "private", label: "Private — only you can see it" },
  { value: "public", label: "Public — anyone can see it" },
] as const;

/**
 * The proposal's GitHub offer (new-project-flow, the approved
 * `new-project.proposal` and `new-project.github-signed-out`): it names the
 * account the repository would be made as and lets the person choose who can
 * see it, private chosen. With nobody signed in (`account` null) the box
 * cannot be ticked and says how to sign in. The page reads the account; this
 * only draws the offer and hands the person's choice on.
 *
 * promise: a-remote-repository-says-whose-and-who-can-see-it
 */
export function GithubOffer({
  account,
  repository,
  remote,
  onChange,
}: {
  /** The GitHub account a repository would be made as; null when nobody is signed in. */
  account: string | null;
  repository: string;
  remote: Proposal["remote"];
  onChange: (remote: Proposal["remote"]) => void;
}) {
  return (
    <section className="grid gap-3 rounded-xl border border-line bg-surface p-4">
      {account === null ? (
        <label className="flex items-start gap-3 text-sm leading-3 text-ink-faint">
          <input type="checkbox" disabled checked={false} readOnly />
          <span>
            A GitHub repository can be created once you are signed in to GitHub
            on this machine. Run{" "}
            <span className="font-mono text-xs text-ink-faint">
              gh auth login
            </span>{" "}
            in a terminal, then reload this page.
          </span>
        </label>
      ) : (
        <>
          <label className="flex items-start gap-3 text-sm leading-3 text-ink-soft">
            <input
              type="checkbox"
              checked={remote.github}
              onChange={(e) =>
                onChange({ ...remote, github: e.target.checked })
              }
            />
            <span>
              Also create a GitHub repository for{" "}
              <span className="font-mono text-xs text-ink-faint">
                {repository}
              </span>{" "}
              as <b>{account}</b>. This is the only step that sends anything off
              this machine.
            </span>
          </label>
          <div className="flex flex-wrap gap-4 pl-6 text-sm leading-3 text-ink-soft">
            {VISIBILITIES.map(({ value, label }) => (
              <label key={value} className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="visibility"
                  checked={remote.visibility === value}
                  onChange={() => onChange({ ...remote, visibility: value })}
                />{" "}
                {label}
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
