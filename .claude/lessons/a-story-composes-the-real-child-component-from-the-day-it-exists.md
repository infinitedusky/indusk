# A story that copies a component's markup approves a drawing, not the component — compose the real child component in the story from the day it exists

PhaseRow's stories hand-drew PhaseItems' fold with different classes, so the approved snapshot was a copy, and a later redraw using the real component cost another approval round and exposed a leaked markdown node attribute. When a component contains another that exists, the story passes the real child. Recorded in the component conventions page.

Source: retro-lesson highlight h-20261015-016 (story-first-phases).
