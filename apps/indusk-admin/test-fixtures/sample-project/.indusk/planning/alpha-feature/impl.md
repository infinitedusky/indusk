---
title: "Alpha Feature — Impl"
status: in-progress
workflow: bugfix
trajectory: required
gate_policy: ask
---

<!-- skip-gates -->

# Alpha Feature — Impl

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Dropdown renders in header | Phase 1 | Phase 1 | passing |
| T2 | Selecting an option re-orders the rows | Phase 1 | Phase 2 | written |

## Checklist

### Phase 1: Dropdown shell

- [x] Add dropdown component
- [ ] Wire to URL state

#### Phase 1 Verification
- [x] T1 passes

#### Phase 1 Document
- [x] dropdown ux note

### Phase 2: Sort logic

- [ ] Implement sort comparators

#### Phase 2 Verification
- [ ] T2 passes

#### Phase 2 Document
- [ ] sort behavior note
