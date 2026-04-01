# One concern per change

Each commit, PR, or change should address one thing. Not two. Not "while I'm in here."

Mixed changes make review harder, reverts riskier, and git blame useless. If you notice something unrelated while working, note it and address it separately.

The exception: if the unrelated fix is a one-line typo or import cleanup in a file you're already changing. Use judgment, but default to separate.
