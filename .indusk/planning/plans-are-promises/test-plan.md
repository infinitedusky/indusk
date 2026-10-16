---
title: "Plans are promises — Test Plan"
date: 2026-10-16
status: accepted
---

# Plans are promises — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean a plan
can hold promises stated as clauses and closes only when every clause is
proved. Each names its level — the smallest that proves it. They are grouped by
the clause of the brief's one promise they prove, since this plan's own brief
was written before clauses exist and states them as prose. They become the
impl's Test Trajectory rows.

"Opted in" below means a brief that declares, in its frontmatter, that its
promises are stated as clauses. A brief that does not is an older-shape plan.

## Behavioral Assertions

### `a-plan-holds-the-promises-it-lands` — A plan makes one or more promises, each stated as clauses, and is done when every clause of every promise it holds is proved.

#### A promise is made of clauses

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | An opted-in brief stating two promises, each with named split and limit clauses, passes the contract check once both promises are declared with those clauses. | unit |
| A2 | An opted-in brief stating a promise with no clause is refused by the contract check, naming the promise. | unit |
| A3 | Declaring a promise with clauses writes each clause — its name, kind and sentence — into the promise's registry file; a clause whose kind is not split, limit or rests-on is refused, naming it, and nothing is written. | unit |
| A4 | An opted-in brief whose clauses differ from the registry's — one missing, one extra, or one reworded — is refused, naming the clause. | unit |

#### Each promise has its clause plan

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | For an opted-in plan with a clause plan, the contract check refuses one that lacks a section for a promise or for a clause, naming which. | unit |
| A6 | A clause in the clause plan with no signal line is refused, naming the clause. | unit |
| A7 | A test row may say it proves one clause of a promise; a row naming a clause the promise does not have is refused, naming it, both when the impl is saved and by the contract check. | unit |
| A8 | For an opted-in plan with an impl, a clause no test row names is refused, naming the clause. | unit |
| A9 | Closing an opted-in plan confirms a promise only when every clause has a passing row with a test file; with one clause unproved the promise stays declared and the refusal names that clause. | unit |
| A10 | The planner's instructions describe the clause plan — one section per promise, a signal and tests per clause, written before the ADR — and its brief template, read by the contract check, states clauses. | unit |

#### A promise can rest on another

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A clause resting on a promise that does not exist is refused at declaration, naming it; at close, a resting clause is proved by that promise being in force, with no row of its own. | unit |

#### Promises that land together share a plan

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A12 | The planner's instructions say promises whose work shares code are one plan, that promises sharing none are separate plans under a master, and that the planner suggests and the person decides. | unit |

#### Older plans stand

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | A plan that has not opted in validates, passes the contract check and closes exactly as before: rows naming its promises are enough, with no clause asked for. | unit |

#### The whole story

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A16 | In a project made for the check, a plan written with the commands — two promises with clauses, a clause plan, an impl whose rows name clauses — passes the contract check, is refused at close while one clause has no passing row, and closes once it does. | live check |

### `every-test-says-what-it-is-for` — must not break

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | A row that names a clause counts as naming its promise wherever rows are read: the promise's proof, its incidents and its standing list that row. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A14 | The save hook and the library read every row's purpose the same way, the clause form included. | unit | a regression guard over the two copies of the row-purpose reader, the library's and the hook's, which must not drift |

## Notes

- Every row but A16 is `unit`: each is a rule fed inputs. A16 is the one run of the commands end to end, recorded in the plan.
- Proving a clause by its signal in use is `mark-first`'s; nothing here reads telemetry.
