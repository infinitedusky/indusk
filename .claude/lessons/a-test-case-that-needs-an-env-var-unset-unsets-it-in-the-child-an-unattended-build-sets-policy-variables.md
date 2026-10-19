# A test case that depends on an environment variable being unset must unset it in the child, because an unattended build runs with INDUSK_GATE_POLICY=auto

gate-policy-env.test.ts's "without it" case spawned the hook with an env of {} merged over the parent's, so inside an unattended build it inherited INDUSK_GATE_POLICY=auto and a must-not-break test failed for that reason alone (fixed in d48bb3427 by defaulting the child env to `{ INDUSK_GATE_POLICY: undefined }`, which spawn drops).

**How to apply:** when a case means "no X set", pass X as undefined in the child's env instead of omitting it. Run a plan's tests once inside the unattended build environment, not only from a clean shell, before calling a must-not-break test green.

Source: highlight h-20261019-015.
