# A DOM path recorded from a live render is not valid against the serialized snapshot — serialization merges adjacent text nodes, so normalize to the snapshot's serialization first and record the node count and the words before and after

component-content's ADR said placed content is "located by structure, not by matching text": a place was recorded as a child path from the marker render. Probes overturned it: a static "· " and a marker's text become one node once the snapshot is serialized, and children spanning several nodes made the path land on the whole node, so the recorded path pointed at the wrong thing.

Why: the live DOM and the serialized snapshot are two different trees. Adjacent text nodes merge on serialization, so any index or path taken from the live tree shifts or collapses in the stored one.

What to do: when recording a location in a snapshot, (1) normalize a clone of the canvas to the snapshot's serialization before computing the path, (2) record the node count and the words immediately before and after the place beside the path, so the place survives a change in node count and can be verified, and (3) test the recording with a static word adjacent to the placed text and with content that spans several nodes.

See component-content's ADR decision on location and its retrospective (correction and retro-lesson highlights, 2026-10-14).
