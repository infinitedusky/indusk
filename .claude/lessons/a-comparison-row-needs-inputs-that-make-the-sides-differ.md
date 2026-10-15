# A row asserting two surfaces or sources agree must be fed inputs that make them differ — identical data lets a swapped or diverging reader pass

Source: cockpit-audit-fixes retrospective (highlight h-20261015-042). Row A10 gave both sources identical data and A5 used a single source, so a reader swapped for another, or drifting, would still pass; the cold audit flagged both. How to apply: when authoring an agreement/parity row, seed each side with distinct values and assert each output follows its own side.
