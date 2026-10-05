# A filter that drops must normalise both sides — compare a tag the way the id it is matched against was made

The promise timeline keeps only marks whose `indusk.project` tag names this project. The project's id is normalised (`timeline-smoke` becomes `timeline_smoke`); the tag is whatever an application wrote. A run tagged `timeline-smoke` was dropped as another project's. Nothing reported it, because a filter that drops leaves no trace.

Why it matters: a silent drop reads exactly like a quiet promise. The live check against Fly only caught it because the run was expected and did not appear.

What to do: when one side of a comparison is a normalised id, put the other side through the same normalisation before comparing. Here `marksBetween` compares `sanitizeGroupId(tag)` with `sanitizeGroupId(project)`. Guarded by `promise-timeline-reader.test.ts` (promise-timeline A15).
