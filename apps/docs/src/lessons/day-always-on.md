# Lessons — always on

## A fixture can agree with the bug

Twenty unit assertions passed against a reader that looked in the wrong place,
because the fixture put the data where the reader looked.

`deployment.environment` is an OpenTelemetry **resource** attribute. A
conventionally instrumented application sets it once on the resource, so it
arrives in Jaeger on the *process* tags. The reader looked only at *span*
tags. The OTLP test fixture — written by the same person, in the same
sitting — put it on the span, matching the reader. Every row was green while
the feature could not work for any real exporter.

What found it was an end-to-end test that spawned a separate process using the
actual OpenTelemetry SDK. The fixture and the implementation shared an
assumption; only an input built by neither could see it.

**When a value crosses a protocol boundary you did not design, at least one
test must construct that input with the real client library.** If you cannot
name such a test, you have not tested the boundary — you have tested your own
round trip. Afterwards, teach the fixture to produce the real shape too and
move one assertion onto that path, so the guard lives in the fast suite.

## "Exactly once" is a durability claim

The skip-if-already-recorded branch is trivially correct and worth nothing.
Every real failure was around it:

1. **Concurrency** — the interval started the next pass whether or not the
   last had finished; both read the record before either wrote it. Twenty-five
   violations became fifty messages.
2. **Write atomicity** — a machine replaced mid-write left a truncated file.
3. **Read failure semantics** — that truncated file read as "empty", which
   re-announced the whole window, every interval, forever. **Missing and
   unreadable are different facts.**
4. **Write failure ordering** — announcing and *then* failing to record is the
   same announcement again next interval. Prove the record is writable before
   the first side effect.
5. **Unbounded fan-out** — hundreds of violations became hundreds of API calls
   in a tight loop; the service rate-limited; all of them counted as un-done;
   the next pass retried all of them. A storm that never converges.

Write those five down and answer each in code before claiming the property.

## A comment asserting safety is evidence it was considered

`readAnnounced`'s comment said an unreadable record "costs a repeated
message." It cost a repeated message *every interval, forever*. The comment
and the code were written in the same sitting by the same person, and the
comment is what made the gap invisible for three phases.

This project already carries the rule — *a safety argument written in a
comment is not enforced by the code around it* — and carrying it did not help.
The only thing that helped was a test that tried the input.

## What arrives on a span is untrusted input to a plan document

The environment and the symptom come from a deployed system and end in
committed YAML and markdown. A newline in `deployment.environment` injected a
duplicate frontmatter key; the parser *threw*; the entire promise registry
stopped parsing. A deployed system could take the plan documents offline by
sending a string.

Sanitize where the value is written, not where it is read. And for values that
can only be mistakes — a credential containing a newline — **refuse rather
than escape**: escaping makes the typo silently work.

## Split the deployment from the thing deployed

A step that needs an account, a domain and a published package is not the same
kind of work as the code it deploys. Holding finished, tested code hostage to
it keeps the code's real problems unfound.

What makes the split honest is marking the unverified artifacts **unverified
where people read them**. A `fly.toml` nobody has executed, shipped under the
word "reference", is a pass asserted without observation.
