# A gate that refuses a skip reason must route to its own next step (shorten the reason), because marking a ritual not-done also changes what an unattended build does next

A long skip reason made nextBuildStep re-run the whole ritual: an audit skip turned into a full audit. The refusal marked the ritual not-done, and the next-step logic reads not-done as "do it". Any check that refuses a skip or opt-out must give the loop a distinct next step (shorten-reason, ask a person), never fall through to the ritual's own step. Before adding a refusal, ask what the unattended loop does when it sees it.

Source: retro-lesson highlight h-20261015-002 (skip-reason handling in nextBuildStep).
