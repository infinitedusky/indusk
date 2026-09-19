# A stub server in the test process cannot answer a spawnSync'd child — spawn asynchronously

`spawnSync` blocks the parent's event loop until the child exits. If the child calls a stub HTTP server that the test started in the same process, the stub can never answer: the child hangs, the test times out, and the failure reads as "slow" rather than as the assertion it was written for. Hit in day-monitor A26 (a fake Jaeger query port answered from the vitest worker while `runCli` used `spawnSync`).

Do: when a spawned CLI must talk to something the test process serves, spawn it with `execFile`/`spawn` and await it; keep `spawnSync` helpers for children that talk to nothing in the parent.
