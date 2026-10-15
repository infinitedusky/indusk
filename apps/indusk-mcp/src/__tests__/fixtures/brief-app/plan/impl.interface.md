---
title: "seat-holds"
status: draft
trajectory: required
test_phases: required
---

# seat-holds

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | a held seat is released when its hold runs out | Test Phase 1 | Build Phase 1 | written |

## Checklist

### Test Phase 1: Red

- [x] T1 written red

#### Test Phase 1 Verification

- [x] T1 fails on its assertion

### Build Phase 1: The release

- [ ] release the seat when its hold runs out
- [ ] keep the timer in the hold

#### Build Phase 1 Verification

- [ ] T1 passes

## Files Affected

| File | Change |
|------|--------|
| `src/Card.jsx` | the change |
