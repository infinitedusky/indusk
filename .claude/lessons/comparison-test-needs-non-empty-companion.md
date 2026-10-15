# A test comparing a computed list with an expected list is unproven until a companion case makes the expected side non-empty

A comparison row passes when both sides are empty. In storybook-components, row A2 compared the `unimplemented component:` lines that coverage prints (no code printed any) with the components actually missing (none): green from the day it was written, found only by a cold audit. Why it matters: an empty-equals-empty pass proves nothing about the producer or the comparison.

What to do: for every test that compares a computed list to an expected list, add a companion case that plants a real member (A40 in storybook-components plants a missing `ghost` component) and asserts it appears on both sides. Also assert the producer's output format exists in code, not only in the test.

Pointer: .indusk/planning/archive/storybook-components/audit.md; related shape: a validator that finds zero items must reject, not vacuously pass.
