# Write exception docs when a process fails

When the agent bypasses a process (skips gates, ignores instructions, takes shortcuts), write an exception.md in the plan directory immediately. Document: what happened, why it was possible, and what would prevent it. This captures the failure while details are fresh and creates a record that can drive follow-on enforcement plans. The GSD-inspired-improvements exception.md led directly to hook-based gate enforcement.
