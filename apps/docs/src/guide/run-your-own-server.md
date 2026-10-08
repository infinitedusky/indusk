# Run your own server

A recording server holds your project's production marks: every promise held
or broken by the running system. Your local admin reads it as the
**production** source beside the local one. It is the
[always-on server](/guide/always-on) InDusk ships, and it is yours: InDusk runs
no server for anyone.

There are two ways to get one, and one command that connects either.

## On Fly, in one command

With the Fly CLI installed and signed in (`fly auth login`), in your project:

```bash
indusk server deploy
```

It creates the app, its volume, its password and its addresses in your own Fly
account, deploys the server image for your version of InDusk, and connects the
project. When it ends, the next promise read shows production. Add
`--slack-webhook-env SLACK_URL` (a variable holding your webhook) for Slack
announcements; without it, the server records and nothing is posted. Every
option is in the [reference](/reference/cli/server#server-deploy).

It costs what Fly charges for one small machine, a 3 GB volume and a dedicated
IPv4 ($2 a month).

## What `connect` records

Both ways end with [`indusk server connect`](/reference/cli/server#server-connect).
It sends one mark through the server and reads it back, and only then:

- names the server in `.indusk/config.json` as `promises.jaeger`, with the
  *name* of the variable that holds the credential;
- stores the credential in `~/.indusk/config.env`, readable by you only.

The config can be committed. The credential never is.
