# A path recorded from one render is valid only against the same node structure

When a location is recorded from one render of a DOM tree and applied to another representation of it (here a live render's paths applied to a serialized snapshot), the paths are only valid if both see the same node structure. Serialization merges adjacent text nodes, so a static word and a marker that share a text node become one node, and a path names the whole node.

What to do instead: normalize a clone of the source to the target's serialization before recording paths, and record enough to survive a mismatch: the number of nodes a value spans, and the static words kept around it. Probe the committed artifacts with a scratch script before trusting a path scheme; the probes found the bug that a happy-path test did not.
