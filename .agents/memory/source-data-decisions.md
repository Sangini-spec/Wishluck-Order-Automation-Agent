---
name: Seed preservation and assignment conflicts
description: User-authorized demo corrections, preservation of originals and safe treatment of imported stock.
---

Use corrected, assignment-aligned demo records in the application. Keep the original upload separately as an immutable reference; do not repeatedly show seed-data problems in the evaluator-facing interface.

**Why:** The user initially prohibited changes to the upload, then explicitly authorized fixing the seed against the assignment and applying those fixes in the app. They said, “I don't want to show errors in data or in seed data in the application itself.”

**How to apply:** Use the corrected demo as the active seed, document authored corrections in developer notes and preserve the original for reference. Apply seed revisions without resetting user-created orders, chats or confirmed runtime actions; abort on conflicting changes. Genuine policy denials such as a non-COD pincode remain normal operational states, not data-error banners.

Only release inventory that the runtime order actually reserved. Do not infer reservations for imported historical orders.

**Why:** The supplied inventory is a current-stock snapshot, not a reservation ledger. Automatically adding imported order quantities on cancellation would silently inflate the supplied stock.

**How to apply:** New checkout/test orders reserve stock atomically and release it once on cancellation or failed checkout payment. Keep imported orders separate from that reservation lifecycle unless an explicit, reconciled reservation is introduced.
