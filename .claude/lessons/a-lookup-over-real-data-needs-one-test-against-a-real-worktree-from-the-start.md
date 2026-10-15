# A lookup over real data (a git hash, a worktree path) needs one test against a real worktree from the start — a fixture stand-in can stay green for phases while the real lookup is wrong

In plan-stories, amendmentsWaiting and the admin's amendmentCounts ran only through a fixture stand-in (decisionsReaderMock) for four phases. The stand-in proved the shape of the call, not the lookup over a real git hash and worktree path. When a function's job is to read real repository state, write at least one test against a real temporary worktree in the first phase that touches it, and keep the stand-in for the cases that need many inputs.

Source: retro-hindsight highlight h-20261015-012 (plan-stories).
