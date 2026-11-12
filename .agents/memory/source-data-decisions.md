---
name: Seed preservation and assignment conflicts
description: Why the original WishLuck source cannot be cleaned up to satisfy assignment examples.
---

Use corrected, assignment-aligned demo records in the application. Keep the original upload separately as an immutable reference; do not repeatedly show seed-data problems in the evaluator-facing interface.

**Why:** The user initially prohibited changes to the upload, then explicitly authorized fixing the seed against the assignment and applying those fixes in the app. They said, “I don't want to show errors in data or in seed data in the application itself.”

**How to apply:** Use the corrected demo as the active seed, document authored corrections in developer notes and preserve the original for reference. Apply seed revisions without resetting user-created orders, chats or confirmed runtime actions; abort on conflicting changes. Genuine policy denials such as a non-COD pincode remain normal operational states, not data-error banners.
