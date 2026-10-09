# Ask design/clarifying questions one at a time, not five at once — a batch answered "looks good" leaves wrong defaults uncorrected until later

When five design questions are posed together and the person replies "looks good" to the set, individual wrong defaults inside that set don't get caught — they get written into research/the ADR as if confirmed, and surface later as a correction instead of a decision.

Why: server-provisioning's planning conversation asked several Fly-deployment design questions as a batch; one answer assumed the account has one Fly organisation, but it actually has three. Because the questions were answered together with a blanket approval, that wrong default went into the research document uncorrected and had to be fixed downstream (the org became part of the recorded Fly state, not a fixed default) rather than caught at decision time.

How to apply: when a plan or spike needs several design decisions from the user, ask them one at a time (or clearly separated) rather than listing them all and asking for one combined approval. A single "looks good" to a list of five is weak evidence that any specific one was actually checked — the person is approving the gestalt, not auditing each line.

See: server-provisioning retrospective, `.indusk/planning/archive/server-provisioning/retrospective.md` ("What We'd Do Differently").
