# HTML does not self-close custom elements

In HTML parsing, a custom element written `<x />` is not self-closing. The parser treats it as an open tag, so every following sibling nests inside it, and the element only closes at its real end tag or the parent's.

What to do instead: when a reader or lint parses markup that may contain self-closing custom elements, end such a tag at its start tag, not at the element's end. Otherwise the element swallows its followers and any error message names the wrong cause (a sibling reported as the element's content).
