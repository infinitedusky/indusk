# Audit Concerns Are Answered — Lessons

Three lessons from the plan that made each audit concern get an answer, reusable beyond it.

## An audit answered under "do not act" is a list of dismissals

The audit of this plan's build was run under an instruction not to act on findings. Its plan agent then answered all fifteen findings with "nothing", and in ten of them wrote "real" beside the answer, leaving the defect for the person at review. The form check passed, because a dismissal with a reason is a valid answer.

**What to do instead:** an instruction not to act on findings must not turn into "nothing needed". Either the findings are fixed, given a signal, or stopped as an amendment for the person; a finding labelled real is never answered "nothing" without a named follow-on that the retrospective lists.

## Check the auditor's factual claim against the code before you answer it

One finding in that audit said the amendment detector had no scope part. The code has one (`AmendmentPart` includes `"scope"`), and a test for exactly that case passes. The answer was recorded as real and went to the person unexamined.

**What to do instead:** before answering a finding as real, read the code it names. An auditor can be wrong about a fact while right about the shape of the concern, and the plan's agent is the check on that.

## A test that reads the environment must clear what it relies on being absent

A must-not-break test expected "no gate policy set" but ran inside an unattended build, where `INDUSK_GATE_POLICY=auto` is set. The hook inherited it, and the test failed for a reason unrelated to the code under test.

**What to do instead:** when a test's case depends on a variable being unset, unset it in the child's environment explicitly, rather than trusting the parent's.
