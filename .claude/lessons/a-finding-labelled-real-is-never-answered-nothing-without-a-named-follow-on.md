# A finding labelled real is never answered "nothing" without a named follow-on; an audit run under "do not act on findings" answers every concern nothing

In audit-concerns-are-answered the audit's findings were answered by an unattended run told not to act on them: all 15 got "nothing", ten with "real" written beside it. `indusk plans audit-answers` passed, because the form check accepts any reason, so a reasoned dismissal and a deferred defect look the same. One finding was also factually wrong (it said the amendment detector had no scope part; amendments.ts:35 has one and A36 passes).

**How to apply:** answer each real finding with a fix, a signal naming its clause, or an amendment. If a real one truly waits, name the follow-on that holds it and list it in the retrospective's Follow-ups. Never give an audit session an instruction that makes its findings un-actionable. Before answering a finding as real, read the code it names; an auditor can be right about the shape and wrong about the fact.

Source: highlights h-20261019-013 and h-20261019-014; plan audit-concerns-are-answered retrospective and /lessons/audit-concerns-are-answered.
