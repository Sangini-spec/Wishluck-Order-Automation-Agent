---
name: Demo time consistency
description: Why business-policy dates and real elapsed deadlines must remain distinct, with one durable demo-time origin.
---

Business-policy time must be consistent across API servers, workers, evaluation processes and restarts. Do not derive the assignment's demo time from each process's start time.

**Why:** A freshly delivered order can pass return eligibility, then appear to have a future delivery timestamp after a server restart and fail the customer's already-prepared consent. The supplied scenarios also rely on an assignment-date timeline rather than arbitrary current-calendar aging.

**How to apply:** Use the shared advancing policy clock for delivery dates and business eligibility windows. Use real elapsed time for sessions, verification TTLs, queue leases and reminder deadlines. Preserve the distinction when adding workflows; a service restart must not change an existing delivery's apparent age backwards.
