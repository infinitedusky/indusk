# A path that exists is not a path that is what you meant — pair every existsSync with "is it the kind of thing I mean"

The promise registry's owner check asked `existsSync(".indusk/planning/<owner>")`. A file (`master.md`) and the `archive` folder itself both answered yes and were accepted as plan owners; falsification found both. The same shape appeared in the link paths: a `..` entry joined onto the code root read a file outside it and called the link satisfied, because the path "existed".

Why it matters: existence is the cheapest question and the one that never fails loudly. Every value a person writes into a document that a tool later joins onto a path is a boundary value.

What to do: when a check is "does X exist", ask "is X the kind of thing I mean" in the same expression — a directory, not a file; not a reserved name like `archive`; a relative path that cannot leave the root (guard with the project's segment/rel-path predicates at read time, before any join). Write the negative case with a real file placed where the unguarded path would reach.
