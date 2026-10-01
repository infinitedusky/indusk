# A test fixture that uses a word nobody uses proves nothing — take one case from real data, and print the real data after the fix

In admin-plan-type, the test for "a spike with finished research is not told to create a brief" wrote its research with `status: completed`. It passed. 33 of the 36 research documents in the repository say `complete`, and the code under test did not count that word as finished, so every real spike still read wrong while the row read green.

What found it was not a test: the phase's Verification asked for the repository's own plans to be printed after the fix, and one read "Review research" beside a bar that said the plan was over.

**Rule:** when a hypothesis is about data people wrote (frontmatter values, status words, config), at least one test case is lifted verbatim from data that exists, not constructed from what you imagine the vocabulary to be. Count the words actually in use before choosing the fixture's word (`grep -h "^status:" … | sort | uniq -c`).

**And:** after a fix, print what the real things now read as and look at it. A constructed case tells you the code handles what you imagined; only the real data tells you whether the defect is gone for the things that exist.

