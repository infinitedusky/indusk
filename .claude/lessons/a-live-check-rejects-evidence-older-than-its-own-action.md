# A live check rejects evidence older than its own action

A live check that looks for "a run that held" or "a break" in a store that outlives the run (Jaeger, a database, a log) passes on yesterday's data. vscode-extension's A28 first passed on an hour-old run from another demo, because the probe accepted any matching run, and the demo tags no project.

Do instead: record the time just before the check's own trigger (the hold, the request, the fault switch), and accept only results stamped at or after it. Time a latency from the event itself, not from an earlier action that includes the system's deliberate delay (A11 first charged the demo's 9.5 s hold window to the editor).
