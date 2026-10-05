# Always-on Deploy — Lessons

From [day-always-on-deploy](/decisions/day-always-on-deploy), closed 2026-10-04.

## What we learned

**Contact with a provider finds gaps in what the tests asserted, not in what
they ran.** All three bugs the deploy found sat in code that green tests
covered:

- the record emptied by a restart;
- a Slack link to loopback;
- a link no browser could log in to.

No test restarted a machine mid-write, read a link the way a person would, or
opened one in a browser.

**"Rename is atomic" describes a dying process, not a stopped machine.** The
comment said the write was safe, and the code did what the comment said. The
comment had the wrong model of failure: the rename reached the disk before the
data did.

**A default listener is a public listener.** An unset Jaeger endpoint bound
every interface without the auth the declared doors carry. A port left to its
default is shared by every instance on the host, and open to anyone who can
reach the host.

**Auth that never sends a challenge works for programs and fails for people.**
Jaeger's basic auth is fine for an exporter and useless behind a link. No test
written by a program notices.

**The smoke and falsification find different things.** The smoke found what
the environment breaks. Falsification, run afterwards on the same code, found
four failures the environment had not yet triggered:

- the start order;
- a dropped connection left open;
- an unchecked URL;
- a short write.

**Provider tools rewrite configuration.** `fly launch --copy-config` kept the
settings and dropped every comment explaining them.

## What we'd do differently

- **Write what a person does with the output as a test row before
  deploying**: click the link, log in. The row that checked the Slack message's
  content passed while the link was broken twice.
- **Ask what a stopped machine leaves on disk when writing any record** that
  must survive restarts, not after one doesn't.
- **Falsify new server code before releasing it.** Two of falsification's four
  findings were in the query door, which had been released the same day.
- **Create the Fly app with `fly apps create` and check the file with `fly
  config validate`**. Never let `fly launch` touch a file written by hand.
