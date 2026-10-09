# Server Provisioning

A project's recording server — the Jaeger with the always-on pass that holds
its production marks — is the person's own. InDusk gives three ways to have
one and runs none for anyone. The full record is the archived plan:
`.indusk/planning/archive/server-provisioning/` (research, brief, test plan,
ADR, impl, retrospective). How to use it: [Run your own
server](/guide/run-your-own-server) and [`indusk server`](/reference/cli/server).

## What was decided

**Connect first, provider-free.** `indusk server connect` does only what is
InDusk's to do: it sends a mark through the server and reads it back, and only
then names the server as the project's production source and stores the
credential on the machine. A server that does not answer is never named.

*Against:* a single command that drove Fly from inside the product. It read as
the beginning of a hosted service, and the parts InDusk owns are the same
wherever the server runs (Sandy, 2026-10-08).

**Fly as the one-command fast path, into the person's own account.**
`indusk server deploy` drives the person's signed-in `fly` CLI behind one seam.
It reads what exists, a pure planner decides the missing steps, it refuses
before writing anything it cannot do, and it ends by running `connect`. A
failed read is a refusal, never "nothing there".

*Against:* Fly's Machines API, which needs a token InDusk would hold; and a
deploy command per provider — anywhere else is the image and the guide.

**The image is published with every release, built from the release's own
tarball.** `pnpm release` builds `ghcr.io/infinitedusky/indusk-always-on:<version>`
for amd64 and arm64 and pushes it before `pnpm publish`; a refused push
publishes nothing. The image and the npm package of a release are the same
bytes, and the build never waits on npm's publish-time scan.

*Against:* building from npm after publishing — npm does not serve a version
for minutes afterwards — and building on Fly per project.

**Credentials live on the machine, named per project.** The project's config
names a variable; its value is in `~/.indusk/config.env`, found by one
function, and the production source reads it there when the environment does
not have it. The variable carries a hash of where the project lives, so two
projects in same-named folders never share one.

**A server may run without Slack.** The day-always-on rule that a server
without a webhook refuses to start is reversed: it records every violation and
nothing is posted.

## Tradeoffs accepted

- The release machine needs Docker and a one-time `docker login ghcr.io`.
- Fly's CLI changes without notice; the live check is re-run at any release
  that touches the deploy, and every refusal names the Fly call.
- A dedicated IPv4 per server, $2 a month, because the query port is not 443.
  A server costs about $8 a month on Fly by its price list.
