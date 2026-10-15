# A cold-audit finding is a lead, not a verdict — evaluate the shipped code before authoring a fix phase for it

In browser-template-claims the audit made two claims about pattern entries: a query is kept literally (true, became Build Phase 3) and a trailing slash makes the entry dead (false: the trim happens before the branch, so it matches). Acting on the second would have added a phase for a non-defect. The auditor reads code and reasons; the regex evaluation is the evidence.

How to apply: before writing a fix row for an audit finding, run the shipped function (or the compiled regex) on the cited input and record the result in the plan; only then author the red test.

See: .indusk/planning/archive/browser-template-claims/retrospective.md ("Getting to Done").
