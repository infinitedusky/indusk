# Scaffold at init, enforce at work, verify at gate

When adding a new cross-cutting concern (OTel, security headers, accessibility), follow this three-layer pattern:

1. **Scaffold** — `init` creates template files so projects start with it configured
2. **Enforce** — a gate in the plan/work lifecycle ensures every impl phase considers it  
3. **Verify** — health checks and verification commands confirm it's working

This prevents the concern from being forgotten. Templates make setup zero-effort. Gates make skipping require explicit opt-out. Health checks catch drift over time.
