# Assignment-aligned demo dataset

The user authorized correcting the supplied seed after reviewing the initial implementation. The app now uses `data/wishluck_seed_data.json` version 2.0.0. The exact uploaded version remains at `data/original/wishluck_seed_data.json` and in the database's `wishluck-original` archive.

All original customer, product, order, shipment, return, refund, COD and shipment-event IDs remain. No customer conversations, runtime orders, jobs, tickets or stock quantities were reset. The correction applies only changed fields that still match the prior import, refuses conflicts with runtime actions and commits atomically.

## Authored corrections

- Normalized all 30 fictitious email addresses into valid `example.test` addresses. These are still separate from login credentials; no automatic identity linking was introduced.
- Matched the assignment's exact ₹4,600 first-time COD example to the address “near Shiv mandir” and a deterministic HIGH score, preserving its merchandise, quantities, discount and exact total.
- Corrected repeat/new-customer flags where prior refusals or returns demonstrate an existing customer. The three-returns scenario now has a count of three and three explicit external historical summaries. Existing external history is explicitly labelled rather than treated as a broken local foreign key.
- Rebuilt courier event times in chronological order, aligned delivered events to each order's delivery date and removed future events relative to the demo clock. Added the two missing failed-attempt/reattempt pairs so both two-attempt timelines really contain two failures. Kept financial refund statuses on orders/payments, not shipments.
- Corrected the four disallowed COD invoices. The already-dispatched failed-delivery example is prepaid/paid; the three undispatched examples require prepaid payment and remain on hold instead of representing accepted illegal COD. The non-COD pincode stays non-COD. These are normal policy states, not data-error banners.
- Added return records for existing refund cases and the missing completed refund record. Made the selected completed COD refund method explicitly BANK_TRANSFER, and corrected refund requests that preceded delivery.
- Kept the ₹1,800 goodwill example as an **unapproved manual-review request**, not an already-approved refund exceeding the order's total.
- Corrected the innerwear record's *time-window* flag. The product is still non-returnable; being within seven days does not make innerwear eligible.
- Removed repeated source-data-problem messages from order lists, sign-in and settings. Validation now returns zero issues; this is not just a cosmetic suppression. Real business denials and operational/API errors remain visible.

## Current import inventory

| Entity | Count |
|---|---:|
| Customers / Products / Orders | 30 / 6 / 30 |
| Order-item lines / inventory rows | 31 / 23 |
| Shipments / events | 21 / 74 |
| Return records / refunds / COD records | 12 / 4 / 7 |
| External historical return summaries | 6 |
| Pincodes / policies / scenarios | 11 / 1 / 13 |

The original 9 NONE return records remain; three additional records describe already-existing refund/return cases. Three COD records now indicate PREPAID_REQUIRED rather than PENDING. Source IDs and phone numbers used in verification tests are unchanged.

Original SHA-256: `b494fd9ec725a12ae6a937de54b12fa9ba11c0965ac2520b8eb5020f4adac196`.

Corrected SHA-256: `0a9fdede4e5c8a4b0051a5abe255944050688cbc28ac5669dad134606534261f`.

## Repeatability and tests

`pnpm --filter @workspace/api-server run db:curate` regenerates the corrected dataset from the checked original, validates it and safely applies the revision. Running it again is a no-op for stored records. `db:seed` imports the corrected dataset on a fresh installation and archives the original too.

The updated suite includes original-data regression tests, corrected-data invariants, preserved-ID checks and exact assignment scenario checks. The earlier LLM evaluation report is a recorded run against the initial dataset, not a new evaluation of this corrected revision.

## New accounts are not scripted sample scenarios

1. A Customer registers and gets a new User linked to a new Customer; they inherit no sample orders.
2. They save their own phone and address in Profile. Missing details block team order creation with an actionable message.
3. They may browse products and ask public catalogue/policy questions immediately. Their order history is legitimately empty until an order exists.
4. A TEAM user creates a test order for that customer using a product, available size/quantity and payment choice. The invoice, inventory check, risk, queue and notifications are generated from the new record.
5. For order-specific chat, the customer still supplies that new order ID and its registered phone. Courier events, failed-delivery recovery, consent-based returns/cancellation and handover use the same code as the demo records.
6. There is currently **no customer checkout, cart or real payment gateway**. The assignment asks for a team “create test order” button or webhook, which is implemented. Self-service purchase is additional scope.

A TEAM account sees the shared authorized operations workspace rather than inheriting one customer's identity. TEAM registration is available only in isolated demo mode; production invitations/admin approval have not been implemented.
