---
title: "Tests-First Planning — Landscape Research"
date: 2026-04-16
status: complete
---

# Tests-First Planning — Landscape Research

Research note surveying prior art and modern practice around "test planning as a first-class planning artifact," to inform the brief for the `tests-first-planning` plan.

Origin: two consecutive retrospectives in the numero codebase (`room-state-persistence`, `chain-of-custody-2`) where Verification items closed without real tests — deferred to "manual check later," then forgotten. Sandy's proposal (preserved as `proposal-origin.md` in this directory) argued for Tests-first within each phase as a template change. This research explores the broader landscape before committing to a shape.

---

## TL;DR

- The idea of "tests as planning/specification artifacts" has rich prior art under **BDD, ATDD, and specification-by-example** — but almost all of it focuses on the *behavior spec* (Given/When/Then) rather than a *cross-phase test trajectory matrix*. Our shape is closer to **safety-critical traceability matrices** in spirit, but agile in tone. That combination appears to be genuinely underserved in public practitioner writing.
- The **less-dogmatic TDD movement** is real and has a canon: Kent Beck's "Canon TDD" (2023), Dan North's evolution from BDD to "TDD is the devil's work," and the broader "tests as design pressure, not doctrine" framing. Sandy's instinct to write-what-you-can-now with a reasoned escape hatch is well-supported — Beck himself calls the test *list* the central artifact, not the red-green cycle.
- **Software Engineering at Google** (Winters et al., 2020) gives us the best vocabulary to adopt wholesale: **test size** (small/medium/large), **test scope** (unit/integration/e2e), **hermeticity**, and the explicit decoupling of the two. "Writable-at-phase" maps cleanly onto their notion that test scope is chosen based on what's available to exercise, not on cargo-culted pyramids.
- Our **"Not Testable in This Plan"** escape hatch has a respectable genealogy: Feathers' *seams*, Fowler's *Self Testing Code* with explicit "testability debt," and aerospace's **Verification Cross-Reference Matrix (VCRM)** where every requirement gets a verification method *or an explicit deferral with justification*. Adopt the justification discipline, drop the ceremony.
- Strongest recommendation: **rename "Test Plan" to something with less bureaucratic baggage** (e.g., "Test Trajectory," "Assertion Ledger," "Verification Map"). "Test Plan" triggers IEEE 829 / ISTQB muscle memory and will make senior devs' eyes glaze. The *shape* is good; the *label* will be load-bearing.

---

## Landscape Map

### The specification-by-example lineage

**Dan North's "Introducing BDD" (2006)** reframed TDD from "test" to "behavior" — the insight being that the word "test" was collapsing two jobs: *design pressure* and *regression safety net*. BDD's contribution to our question is the **scenario** as a dual-purpose artifact: readable by business, executable by machines. Gherkin's `Feature / Scenario / Given-When-Then` is a planning artifact first, a test second.

**Gojko Adzic's *Specification by Example* (2011)** is the most directly relevant book for our goal. Adzic's thesis: the specification, the test, and the documentation should be *the same artifact*. He introduces **"key examples"** as a planning output — a curated, minimal set of examples that define a feature's behavior. These map *very* closely to our "test IDs" — each example has a stable identity, a thing it asserts, and a lifecycle. Worth reading Chapter 8 ("Refining the Specification") specifically.

**ATDD (Elisabeth Hendrickson, Lisa Crispin, Janet Gregory)** — the "three amigos" practice (PM + dev + QA agreeing on acceptance tests before work starts) is the closest cultural ancestor of "testability as a planning concern." Crispin & Gregory's *Agile Testing Condensed* (2019) is the concise modern reference.

Adjacent: Matt Wynne's **Example Mapping** (2015) — a 25-minute workshop format that produces a story + rules + examples + open questions. The *open questions* column is essentially our "Not Testable in This Plan" escape hatch in embryonic form.

### The post-TDD / less-dogmatic wing

**Kent Beck's "Canon TDD" (Substack, Dec 2023)** is the single most important recent piece for our framing. Beck's argument: the *canonical* TDD loop is:

1. Write a list of tests you want
2. Pick one, write it, make it pass
3. Refactor
4. Repeat, editing the list as you learn

The **test list is the artifact.** Red-green-refactor is the mechanics. Beck explicitly calls out that most TDD discourse has collapsed the practice into the mechanics and lost the list. Our Test Plan table is **Beck's test list, made durable and shared across a team**. This is the single clearest prior art for what we're building.

**Dan North, "TDD is the devil's work" / "Why Every Element of SOLID is Wrong"** — North's later writing argues TDD-as-design-method produces overly-abstracted code. His alternative is a more **discovery-oriented** process: spike, explore, *then* write tests around what you've learned. Our "writable-at-phase" column implicitly supports this — tests become writable when the *shape* is known, not before.

**James Shore, *The Art of Agile Development* (2nd ed, 2021)** — Chapter "Test-Driven Development" is the most humane modern treatment. Shore explicitly distinguishes "TDD as a learning tool" from "TDD as a deliverable artifact" and argues teams should plan the latter.

### The Google school

**Winters, Manshreck, Wright, *Software Engineering at Google* (O'Reilly, 2020)** — Chapters 11-14 on testing are the strongest industry-scale treatment. Key concepts to steal:

- **Test size** (small/medium/large) is orthogonal to **test scope** (unit/integration/system). Size describes *resource footprint and hermeticity*; scope describes *what's under test*. Collapsing them (as pyramid diagrams do) loses information.
- **Beyoncé Rule**: "If you liked it, you should have put a test on it" — but applied selectively. Not every line. Every *invariant you care about.*
- **Test doubles hierarchy** (fakes > stubs > mocks, usually) — relevant for our "writable-at-phase" because a test may be writable at phase N with a fake and only at phase N+2 against the real thing.

**Titus Winters' talks on "test impact analysis"** (CppCon 2019, Build Stuff 2020) — Google decides what to *run* based on what changed. This is orthogonal to our problem (which is what to *write*), but the mental model of "tests as a graph with edges to code" is transferable.

### The pyramid-skeptics

**Kent C. Dodds' "Testing Trophy" (2018, refined since)** — argues for a different shape: static → unit → integration → e2e with **integration** as the fat middle. The core insight relevant to us: *the cost/value of a test depends on what it asserts against, not where it sits in a layer cake.* Our "what it asserts" column is more important than any implicit layer.

**Martin Fowler, "On the Diverse And Fantastical Shapes of Testing" (2021)** — a meta-essay acknowledging the trophy/pyramid/honeycomb wars and concluding that **the shape doesn't matter; the conversation the shape forces does**. Strong support for our "test planning as communication artifact" framing.

### The contract / property / approval wings

**Contract testing (Pact, Ian Robinson's "Consumer-Driven Contracts," 2006)** — tests as *interface agreements between components*. Most relevant when a plan spans component boundaries: the contract itself is a planning artifact, and "writable-at-phase" becomes "writable when the contract is agreed, passes when both sides implement it."

**Property-based testing (John Hughes, QuickCheck, 1999; Hypothesis, fast-check)** — Hughes' talks ("Don't Write Tests," 2019 especially) argue properties are *higher-leverage specs* than examples. For our table: a single property test ID can replace dozens of example-based ones, which affects the density of the table usefully.

**Approval/snapshot testing (Llewellyn Falco, ApprovalTests)** — Falco's "Golden Master" technique is the pragmatic escape hatch when you *can't articulate* the spec but can recognize correct behavior. Relevant to our "Not Testable in This Plan" column: sometimes the honest answer is "not articulable yet, will approve after first run."

### Formal methods / model-based

**Hillel Wayne's writing on TLA+ and specification** (*Practical TLA+*, 2018; "Why Don't People Use Formal Methods?" 2019) — formal specs are the *ultimate* test plan: they define what's true independent of implementation. For complex state (consensus, concurrency, financial invariants) they outperform example-based tests. For most feature work they're overkill. Worth citing as an upper bound on "test language."

---

## Prior Art for "Test Plan as Artifact"

**Direct ancestors we are reinventing (knowingly or not):**

1. **Aerospace / DO-178C / NASA STD-8719** — **Verification Cross-Reference Matrix (VCRM)**. Every requirement gets a row; columns are verification methods (Inspection, Analysis, Demonstration, Test) and the *lifecycle phase* at which verification occurs. Our `writable-at-phase` / `passes-at-phase` is a direct descendant of this pattern, minus the bureaucracy.
2. **IEEE 829-2008 "Standard for Software Test Documentation"** (superseded by ISO/IEC/IEEE 29119-3) — prescribes a "Master Test Plan" with traceability matrices. Heavy, but the *structure* (test ID, feature, priority, status) maps onto ours. The reason to *not* cite this as inspiration is that the associations are poisoned in developer culture.
3. **Agile "Story Maps + Acceptance Criteria" (Jeff Patton, *User Story Mapping*, 2014)** — Patton's backbone/walking-skeleton structure already implicitly tracks "what becomes verifiable when." Our table makes that implicit structure explicit.

**What's genuinely novel about our shape:**

- The **writable-at-phase vs passes-at-phase distinction** is, as far as we can find, not a named pattern anywhere in mainstream practitioner writing. BDD scenarios are assumed to be writable at spec time. Aerospace VCRMs conflate writable with ready-to-execute. The explicit separation — "I can write this test today, but it can't pass until phase 4" — is a useful distinction that doesn't seem to have a canonical home.
- The **narrow, justified escape hatch** ("Not Testable in This Plan — reason: X, would require: Y") has ancestors (Feathers' "legacy code" seams, Fowler's "self-testing code") but we can't find it formalized as a *planning column*. Making this a first-class citizen with a required `would require` field is a real design move — it turns untestability into actionable backlog.

**Verdict:** our shape is ~70% derivative of well-known ideas (Beck's test list, Adzic's key examples, aerospace VCRM, ATDD's three amigos) and ~30% a genuine synthesis. That's a healthy ratio. It's not a reinvention; it's a re-combination.

---

## Recommendations

### Keep

- **The table-at-top-of-impl-doc shape.** Beck's "test list" + Adzic's "key examples" both argue for a single, flat, visible artifact. Burying tests in per-phase sections loses the trajectory.
- **Test IDs as stable handles.** Being able to say "T-03 still can't pass" in a standup is high-leverage. IEEE 829 got this right even if it got everything else wrong.
- **Per-phase verification sections that just reference test IDs.** This is correct — it decouples the *what* from the *when*.
- **The escape hatch with mandatory `reason` and `would require`.** Make both fields non-optional. The `would require` is the more valuable one — it converts untestability into a tracked prerequisite.

### Adjust

- **Rename "Test Plan."** Strong recommendation. "Test Plan" is contaminated by ISTQB / IEEE 829 / enterprise QA. Candidates, in order of preference:
  - **Assertion Ledger** — signals "things we claim are true" + "tracked over time." Novel enough to not trigger muscle memory.
  - **Test Trajectory** — emphasizes the cross-phase motion, which is our novel contribution.
  - **Verification Map** — if we want to lean into the aerospace lineage explicitly.
  - Avoid: "Test Matrix" (too IEEE), "Test Strategy" (too management), "Test List" (Beck already owns it but the term is too thin).
- **Add a "scope" or "size" column.** Adopt Google's small/medium/large or at minimum unit/integration/e2e. Without it, readers will conflate a 2ms unit property test with a 30s docker-compose e2e and reason poorly about cost.
- **Add a "kind" column** for example / property / contract / approval / formal. This is cheap metadata that prevents arguments later about whether "T-05 property: idempotency of sync" is "really a test."
- **Rename `status`**. "Status" collapses too much. Split into `state` (planned / writable / written / passing / blocked) and optional `evidence` (link to run, commit, or PR). This mirrors Beck's list discipline — items get crossed off, not just checked.

### Name differently to tap existing vocabulary

- Call the escape hatch **"Deferred Verification"** rather than "Not Testable in This Plan." Same meaning, plugs directly into the aerospace lineage, and "deferred" accurately implies "tracked, not abandoned."
- Call the top-level artifact's role **"Specification by Example"** in the doc preamble (even if we don't use Gherkin) — it grounds the reader in Adzic's tradition and pre-empts "why are tests at the top of this doc."
- For cross-phase dependencies between tests, borrow Google's **"hermeticity"** as a property — a test is hermetic at phase N if all its dependencies exist at phase N. This gives us precise language for why `writable-at-phase` is what it is.

---

## Anti-Patterns and Mitigations

1. **Tests calcify a bad design.** The classic critique (North, DHH's "TDD is dead" 2014, Jim Coplien's "Why Most Unit Testing is Waste" 2014). **Mitigation:** the `writable-at-phase` column is itself the mitigation — it acknowledges that tests written before the shape is known *will* calcify. Explicitly allow `writable-at-phase: "after spike"` or `"after phase 2"` to defer.
2. **Test plan becomes a compliance artifact nobody reads.** IEEE 829's actual fate. **Mitigation:** keep it *in* the impl doc, not in a separate QMS. Make it the *first* thing in the doc. Require per-phase verification sections to reference test IDs so the table gets re-read every phase.
3. **Over-specifying at plan time.** Risk of writing 40 test rows for a feature that needs 6. **Mitigation:** Adzic's "key examples" discipline — prefer the *minimal* set that captures the behavior. Property tests (one ID, many cases) compress the table. Explicitly allow the table to grow during implementation; it's a living artifact, not a contract.
4. **"Not Testable" becomes a dumping ground.** Once escape hatches exist, they get abused. **Mitigation:** require `would require: {specific thing}`. A row with `would require: "..."` that's vague fails review. In retrospective, audit the escape hatches — did the "would require" conditions actually materialize? If not, either the plan was wrong or the test was never needed.
5. **Tests-as-planning becomes tests-as-contract with QA.** The three-amigos practice can devolve into "devs write tests to satisfy QA" rather than collaborative spec. **Mitigation:** the artifact lives in the impl doc, owned by the implementer, not in a QA tool. This is structural, not cultural.
6. **Phase boundaries drive false test granularity.** If phases are arbitrary, `writable-at-phase` becomes arbitrary. **Mitigation:** phases in InDusk impl docs already correspond to natural implementation checkpoints. Keep it that way. If a phase exists only to house a test, that's a planning smell.

---

## Reading List

1. **Kent Beck, "Canon TDD"** — https://tidyfirst.substack.com/p/canon-tdd — the single most relevant recent piece. The test list *is* the artifact.
2. **Gojko Adzic, *Specification by Example*** (Manning, 2011), especially Ch. 7-9. The "key examples" chapter is the conceptual ancestor of our table.
3. **Winters, Manshreck, Wright, *Software Engineering at Google*** (O'Reilly, 2020), Chapters 11-14. https://abseil.io/resources/swe-book — free online. Steal the size/scope/hermeticity vocabulary.
4. **Dan North, "Introducing BDD" (2006)** — https://dannorth.net/introducing-bdd/ — the original reframing from "test" to "behavior."
5. **Martin Fowler, "On the Diverse And Fantastical Shapes of Testing" (2021)** — https://martinfowler.com/articles/2021-test-shapes.html — synthesizes the pyramid/trophy/honeycomb debate into "the conversation is the point."
6. **Kent C. Dodds, "The Testing Trophy and Testing Classifications" (2021)** — https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications — the modern pyramid alternative.
7. **James Shore, *The Art of Agile Development* (2nd ed, 2021)**, "Test-Driven Development" chapter. The most humane treatment of TDD as a learning tool vs. deliverable artifact.
8. **John Hughes, "Don't Write Tests" (2019 keynote)** — https://www.youtube.com/watch?v=hXnS_Xjwk2Y — the canonical argument for property-based tests as higher-leverage specs.
9. **Matt Wynne, "Introducing Example Mapping" (2015)** — https://cucumber.io/blog/bdd/example-mapping-introduction/ — the 25-minute workshop format that anticipates our "open questions" / escape hatch column.
10. **Hillel Wayne, "Why Don't People Use Formal Methods?" (2019)** — https://www.hillelwayne.com/post/why-dont-people-use-formal-methods/ — useful upper bound on "how far can spec-as-artifact go."

Bonus (older but cited briefly):
- Michael Feathers, *Working Effectively with Legacy Code* (2004), "Seams" chapter — still the best vocabulary for *why* code is untestable.
- DO-178C / RTCA — if someone wants to know where VCRMs come from, but don't make anyone read it.

---

## Referenced Documents

- `proposal-origin.md` — Sandy's original proposal authored 2026-04-16 from the numero retrospectives
- `/Users/the_dusky/code/sandbox/numero/.indusk/retro/room-state-persistence.md` — origin retrospective (deferred restart-recovery test)
- `/Users/the_dusky/code/sandbox/numero/.indusk/retro/chain-of-custody-2.md` — origin retrospective (~1/3 verification deferral)
- `.claude/lessons/gate-policy-ask-leads-to-universal-deferral.md` (numero) — the lesson this plan operationalizes
