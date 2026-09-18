# A reader that reports problems must still return what it read — one bad file must not shrink the world every page sees

The first `readPromises` returned only `{ problems }` when any registry entry was malformed. The admin page would have shown the error block and nothing else: one bad file hiding every well-formed neighbour, which is the opposite of naming the bad file.

Why it matters: "a malformed entry is named, never skipped" is the rule; a reader whose failure mode is "return nothing but the complaint" satisfies the letter (the entry is named) and breaks the point (the reader's world shrank). Any downstream surface then renders an empty table under an error, and the empty table reads as "there is nothing here".

What to do: a read with problems carries the partial result beside them (`{ ok: false, problems, partial }`), the consumer renders both, and a test asserts the well-formed neighbour is still listed next to the error block. Judge registry-wide integrity (duplicate aliases, an alias equal to a live name) after every entry is read, naming every file involved.
