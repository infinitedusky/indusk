# A live planning session waiting for the person is idle — "writing" is a turn (SessionManager.isWriting), not process liveness

Source: cockpit-audit-fixes retrospective (highlight h-20261015-041). Treating a session's liveness as activity held plan approval back while the session was only waiting for the person. SessionManager.isWriting is true from start/say/reply until the next result event. How to apply: gate on isWriting, never on whether the process is alive.
