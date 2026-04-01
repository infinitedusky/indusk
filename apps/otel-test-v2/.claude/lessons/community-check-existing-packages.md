# Search for official packages before building custom

Before building any integration, SDK wrapper, or utility:

1. Check if an official package exists (npm, PyPI, crates.io)
2. Check if a well-maintained community package exists
3. Only build custom if nothing exists AND the need is truly unique

Official implementations are battle-tested, maintained, and handle edge cases you haven't thought of. Custom implementations create tech debt and break in production.
