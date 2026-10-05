# A refusal that names a command needs a test that runs that command on the refused case

In planner-promises, `promises confirm` refused a replacement declared without its link and told the reader to run `indusk promises replace` — which refused that exact case because the name already existed. The registry check told an archived plan's owner to confirm or mark it by hand; confirm refused archived plans. Each refusal message was a claim about another command, and nothing tested the claim. Falsification found both (A38, A43).

Why it matters: a refusal's advice is the user's only way out. Advice that leads to a second refusal is a dead end that looks like guidance, and the user ends up editing state by hand — the thing the commands exist to prevent.

What to do: when a refusal names a command to run, write the test that follows the advice — reproduce the refused state, run the named command, and assert the original command then succeeds. Write it with the refusal, not later.
