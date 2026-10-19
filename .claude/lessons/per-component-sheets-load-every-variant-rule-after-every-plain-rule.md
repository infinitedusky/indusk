# Per-component stylesheets loaded side by side must load every variant (@media/@supports/@container) rule after every plain rule

Tailwind orders variant rules after plain rules within one build; nothing orders them across separate per-component sheets. In mockups-draw-components-as-stories a later component sheet's plain `.flex` undid an earlier sheet's `max-[759px]:hidden`, which produced 611 composition failures at phone width (found only when the composition check began drawing at every reference device).

How to apply: when sheets are concatenated or loaded side by side, split each into plain and variant rules (`splitVariants` in component-styles.ts) and emit all variants after all plain rules. A check that draws at one width cannot see this bug; test at the narrow device. Record: .indusk/planning/mockups-draw-components-as-stories/impl.md, Build Phase 5 (T7).
