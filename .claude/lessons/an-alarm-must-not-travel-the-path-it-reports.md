# An alarm must not travel the path it reports broken — and it speaks on a change of state, not on every check

The always-on server's watcher can go deaf: its Jaeger stops taking spans, or stops answering. If the warning went through that Jaeger, the failure would silence its own alarm. If it went out on every pass while the state held, it would be a flood, and the channel would be muted within the hour.

Why it matters: a monitor that cannot report its own failure reports health by default, the worst case reading as the most reassuring one. A monitor that repeats itself every minute trains people to ignore it, which ends the same way.

What to do: send the alarm over a channel that does not depend on the thing being watched. Here that is Slack over HTTPS, never Jaeger. Send it only on a transition: once on going blind, once on recovering. Record the state only after the channel accepts the message, so a failed post is retried on the next pass rather than lost (`heartbeatPass` and `watcherTransition`, `lib/always-on/heartbeat.ts`). Run one pass at a time per volume, or two overlapping passes both see the old state and both speak. Guarded by `watcher-heartbeat-server.test.ts` (A7), which freezes the Jaeger and expects exactly one message each way.
