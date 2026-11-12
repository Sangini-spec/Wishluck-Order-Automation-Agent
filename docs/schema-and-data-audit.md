# Historical pre-build audit

This document records the **original upload review**, not unresolved problems in the current app. The user later authorized corrections. See [the current dataset and correction record](demo-data-corrections.md) for active counts and behavior.

# WishLuck: assignment review and pre-implementation data contract

## Decision

Approve the architecture with the corrections below. The master prompt is not arbitrary: it addresses the assignment's Node.js/React stack, tool-calling agent, verification, deterministic policies, COD and NDR workflows, human handover, persistent data, live inbox, queue, webhook safety, tests and documentation. However, a full storefront, registration system and nine dashboard modules are additional scope, not the main evaluation target. Implement working vertical flows before polishing these additions.

The original assignment is authoritative for business rules. Preserve the supplied JSON exactly, including intentional invalid-policy orders and inconsistent historical evidence. Do not silently reinterpret a scenario label as a fact.

This is a design and source-data audit, not a claim that a database has already been created or tests have run.

## Exact source inventory and model mapping

| JSON path | Database model or representation | Initial count |
|---|---|---:|
| `dataset_metadata` | `SeedDataset.metadata` (complete JSON object) | 1 |
| `products[]` | `Product` | 6 |
| `products[].sizes[]` | `Product.sizes` ordered string array | 23 values |
| `customers[]` | `Customer` | 30 |
| `customers[].address` | `Customer.address` structured JSON snapshot | 30 |
| `customers[].return_history_last_60_days[]` | `CustomerReturnHistory` | 3 |
| `orders[]` | `Order` | 30 |
| `orders[].payment` | `OrderPayment` (one-to-one with Order) | 30 |
| `orders[].items[]` | `OrderItem` | 31 lines, 40 units |
| `orders[].shipping_address` | `Order.shippingAddress` structured JSON snapshot | 30 |
| `orders[].notes[]` | `Order.notes` ordered string array | 4 values |
| `shipments[]` | `Shipment` | 21 |
| `shipments[].events[]` | `ShipmentEvent` | 70 |
| `inventory[]` | `Inventory` | 23 |
| `returns[]` | `ReturnRecord` (source records, not automatically opened requests) | 9 |
| `refunds[]` | `Refund` | 3 |
| `cod_confirmations[]` | `CODConfirmation` | 7 |
| `pincode_serviceability[]` | `PincodeServiceability` | 11 |
| `policy` | `PolicyVersion.document` (complete object containing seven sections) | 1 |
| `demo_scenarios[]` | `DemoScenario` | 13 |
| `notes` | `SeedDataset.notes` (complete object containing four notes) | 1 object |

The three historical return entries are additional to the nine top-level return records. They must not become three fabricated full orders or three extra active return requests.

## Proposed database schema

Use PostgreSQL with Prisma. Money is Decimal(12,2) in INR, not floating point. Dates containing offsets are stored as timestamptz; date-only fields remain dates. Identifiers from the source are preserved verbatim. New identifiers are deterministic for imported nested records without IDs and generated for runtime records.

Every source-backed row carries `seedDatasetId`, `sourcePath`, and `sourceRecord` JSON. `SeedDataset` also preserves the entire original source text, version and SHA-256. These are restricted database evidence, not application logs or LLM context. This retains unknown fields, original timestamp strings, ordering and original spelling alongside queryable columns.

### Source-backed models and exact field coverage

**SeedDataset**
- `id`, `name`, `version`, `sourceFilename`, `sha256` unique, `originalText`, `metadata` JSON, `notes` JSON, `importedAt`.
- `dataset_metadata` and all its fields remain intact, including generated-at offset and declared counts.
- One import identity for this file, not one new dataset every startup.

**Customer**
- `id` = `customer_id` primary key.
- `name`, `email`, `phone`, `address` JSON containing all eight supplied address keys.
- `isFirstTimeCustomer` = `is_first_time_customer`.
- `codRefusalsLast12Months` = `cod_refusals_last_12_months`.
- `returnsLast60Days` = `returns_last_60_days`.
- `customerSince` = `customer_since`.
- Optional one-to-one link from `User.customerId`; source customers do not automatically become login accounts.
- Preserve source email verbatim. Authentication email validation applies to User, not to archival fictional customer contacts.
- A normalized phone can be derived separately for comparison; never replace the source phone.

**CustomerReturnHistory**
- `id` = nested `return_id` primary key; `customerId` foreign key.
- `sourceOrderId` = nested `order_id`, retained as a string even when the historical order is absent.
- `linkedOrderId` nullable FK, set only if that actual order exists.
- `status`, `daysAgo` = `days_ago`; no fabricated timestamp or absent product/customer/order details.

**Product**
- `sku` primary key, `name`, `category`, `price`, `sizes` string array, `returnable`, `exchangeable`, `notes`.
- Do not infer body measurements or a size chart from the list of size names.

**Inventory**
- Composite primary key `(sku, size)`, `sku` FK to Product, `available` nonnegative integer.
- Validate size membership against Product.sizes.
- Existing stock is the supplied available stock; importing historical orders must not decrement it again.

**Order**
- `id` = `order_id` primary key, `customerId` FK, `scenarioTag` = `scenario_tag`.
- `createdAt`, `currency`, `status`, `fulfillmentStatus` = original `fulfillment_status`.
- `shippingAddress` JSON, `deliveredAt` nullable, `customerVerificationRequired`, `notes` string array.
- Shipping address is an order snapshot, separate from the customer's current address.
- Maintain an order/contact verification binding; any initially derived phone snapshot must be marked as derived from the linked customer, since the JSON has no order-phone field.

**OrderPayment**
- `orderId` primary key/FK.
- `method`, `status`, `subtotal`, `shippingFee`, `codFee`, `discount`, `total`, `amountDueAtDelivery`.
- All fields map one-for-one from `orders[].payment`; no recalculation overwrites them.
- Future simulated payments use separate `PaymentAttempt` records and change payment state only after verified simulation success.

**OrderItem**
- `id` derived deterministically from order ID and zero-based item index; unique `(orderId, sourceIndex)`.
- `orderId` FK, `sku` FK, `productName`, `quantity`, `unitPrice`, `size`, `isSaleItem`, `isInnerwear`.
- Keep order-time product name, price and flags even if the catalogue changes.
- Multiple quantities do not become multiple source item rows; 31 lines contain 40 units.

**Shipment**
- `id` = `shipment_id` primary key; `orderId` FK (schema supports multiple shipments per order).
- `carrier`, `trackingNumber`, `trackingUrl`, `status`, `attemptCount`, `estimatedDeliveryDate` nullable, `lastFailureReason` nullable.
- Preserve the supplied status even when it is a financial rather than courier status. A separately labelled transport projection can use the latest actual courier event.

**ShipmentEvent**
- `id` = `event_id` primary key; `shipmentId` FK.
- `status`, `reason` nullable, `occurredAt`, `source`, `sourceIndex`.
- Importing event history does not replay webhooks or send customer notifications.

**ReturnRecord**
- `id` = `return_id` primary key; `orderId`, `customerId` FKs with enforced ownership agreement.
- `status`, `deliveredDaysAgo`, `eligibleByWindow`, `reason` nullable, `qualityCheckStatus`, `exchangeCountForItem`.
- `orderItemId` nullable: the JSON has no item reference. Do not invent one in source data.
- All nine supplied records have status NONE. They are preserved eligibility/scenario records, not nine submitted returns.
- `ReturnRequest` is a separate runtime model for a real customer-confirmed return or exchange.

**Refund**
- `id` = `refund_id` primary key; `orderId`, `customerId` FKs with enforced ownership agreement.
- `amount`, `status`, `method`, `requestedAt`, `qualityCheckStatus`, `policyNote`.
- `returnRequestId` nullable; no matching return request is supplied for any of the three refunds.
- Runtime fields such as `qualityCheckedAt`, `completedAt`, `selectedPayoutMethod` and `approvedBy` nullable until actual evidence exists.
- Retain the ambiguous source method BANK_TRANSFER_OR_STORE_CREDIT; do not invent the customer's selection.

**CODConfirmation**
- `orderId` unique FK/primary key; `customerId` FK with enforced ownership agreement.
- `riskScore`, `riskBand`, `riskReasons` string array, `status`, `messageSentAt` nullable.
- `reminderDueAfterMinutes`, `holdAfterMinutes`, `options` ordered string array, `prepaidDiscountPercent`.
- Future response, reminder-sent and hold timestamps remain null until events actually happen.
- Keep imported scores as source scores. Versioned `RiskAssessment` records hold new deterministic calculations; the UI distinguishes them.

**PincodeServiceability**
- `pincode` primary key as text, `city`, `codAvailable`.
- `cod_available=false` means COD unavailable, not necessarily that all prepaid delivery is unavailable.
- The file does not define general shipping serviceability for every possible new pincode. Unknown pincodes require an explicit configured lookup/manual fallback; never assume serviceable.

**PolicyVersion**
- `id`, `seedDatasetId`, `version`, `document` JSON preserving all seven source sections, `createdAt`.
- Typed policy code reads and validates this authoritative configuration. Mutable workflow settings do not silently weaken the assignment policy.

**DemoScenario**
- Deterministic `id` based on dataset and array index, `scenario`, `expected`, `orderId` nullable FK, `sourceIndex`.
- Nine scenarios reference existing orders; four are intentionally order-independent.

**DataQualityIssue**
- `id`, `seedDatasetId`, `entityType`, `entityId`, `code`, `severity`, `evidence` JSON, `handling`, `createdAt`.
- Stores the discrepancies below, without changing or deleting source records.

### Runtime models (not supplied by the JSON)

These begin empty except explicitly documented demo accounts and settings. They are not part of the 30 source customers/orders.

| Model | Main keys and fields |
|---|---|
| User | id, username/email unique, passwordHash or auth identity, role CUSTOMER/TEAM, customerId nullable unique, createdAt |
| Session | id, userId FK, expiry, revocation; secure server-managed authentication |
| Conversation | id, customerId/userId nullable, status, language, assignedTeamUserId nullable, intent, timestamps |
| ConversationOrderVerification | id, conversationId, orderId, verifiedCustomerId, verifiedAt, expiry; server-issued scope, no raw phone in logs |
| Message | id, conversationId FK, sender type, content, language, createdAt, delivery state |
| PendingAction | id, conversationId/orderId, exact action/payload, expiry, state, consumedAt; single-use confirmation binding |
| SupportTicket | id, conversationId FK, orderId nullable, reason, mood, summary, editableSuggestedReply, priority, status, assignee |
| ReturnRequest | id, orderId/customerId/orderItemId FKs, kind RETURN/EXCHANGE, quantity, requestedSize, condition evidence, consent, status, timestamps |
| RiskAssessment | id, orderId FK, score, band, reasons, inputs, scoringVersion, evaluatedAt |
| NDRCase | id, shipmentId/orderId, failure count, reason, outreach and response state, retry date, correction payload, refusal reason |
| PaymentAttempt | id, orderId FK, quoted discount and amount, simulation status, idempotency key, confirmedAt |
| Notification | id, orderId/conversationId, type, payload, status, deduplication key, sentAt |
| OutboxJob | id, type, payload, unique deduplication key, dueAt, state, attempts; durable bridge to BullMQ |
| WebhookEvent | id, provider, externalEventId, payload hash, signature-validation status, processing state/timestamps; unique provider/event key |
| AgentToolExecution | id, conversationId/messageId, toolName, validated/redacted input and output, status, duration, error, timestamps |
| AgentRun | id, conversationId, intent, language, provider/model, tokens, latency, cost if measurable, grounding/test evidence |
| AuditLog | id, actor, action, orderId/conversationId, protected old/new values, timestamp; masked log/display projections |
| AppSetting | key, validated value, version, updatedAt, updatedBy; reminder timings, risk settings and operational settings |
| EvaluationRun / EvaluationCaseResult | actual agent-test inputs, expected and observed tools/outcomes, pass/fail, latency, usage, evidence |

## Relationship audit results

Checks actually performed on the entire source:
- No duplicate customer, product, order, shipment, return, refund or shipment-event IDs.
- No duplicate inventory `(sku,size)` keys.
- All 30 orders point to existing customers; all 31 item lines point to existing products and valid sizes.
- Every top-level shipment, return, refund and COD confirmation points to an existing order.
- Every supplied return/refund/COD customer agrees with its order owner.
- All catalogue size variants have inventory rows; all customer/order pincodes appear in the supplied pincode table.
- Item subtotals and payment-total arithmetic reconcile for all 30 orders.
- There are 21 shipments and nine orders without shipments; the nine are unfulfilled or cancelled, not broken references.
- The three historical return order references are unresolved, as detailed below.

## Missing or inconsistent evidence and non-destructive handling

1. **Historical return orders absent.** CUST-1017 has HIST-RET-01/02/03 referencing HIST-WL-9001/9002/9003, none of which exists in orders. Preserve them in CustomerReturnHistory with sourceOrderId and null linkedOrderId. Do not invent orders.

2. **The three-returns scenario points at the wrong customer.** WL10248 is labelled three_returns_customer but belongs to CUST-1015, whose supplied count is one. CUST-1017 has the actual count of three and historical entries; their current order is cancelled WL10250. Preserve everything and apply manual review to actual linked customer evidence, not the tag. Demonstrate the manual-review rule in a new, clearly labelled runtime test fixture if needed.

3. **Delivery timestamps conflict.** Ten orders' delivered_at values differ from their shipment DELIVERED event timestamps: WL10239, WL10240, WL10246, WL10247, WL10248, WL10252, WL10259, WL10260, WL10262, WL10263. Preserve both. For imported policy scenarios, use Order.deliveredAt as the explicitly documented policy date; show the contradictory courier evidence and warning. New courier deliveries update both consistently through one audited transaction.

4. **Future courier history.** Five events are after the dataset's generated_at: SE-010-2/3/4/5 and SE-019-4. Preserve and flag them; do not send historical outreach or claim these future events occurred live.

5. **NDR attempt counts exceed timeline detail.** WL10242 and WL10243 each report two attempts but contain only one DELIVERY_FAILED event. Keep attemptCount and event history independently. They can seed an NDR view, but missing messages must not be treated as proof that the customer ignored two follow-ups.

6. **Refunds have no linked return records or QC timestamps.** WL10244, WL10245 and WL10253 have refunds but no top-level return record. requested_at equals each order's creation time, before its delivered_at. Preserve; do not fabricate a return, QC timestamp or completion date. A PASSED status without a QC timestamp cannot support an exact 5–7-working-day deadline. A REFUNDED payment on cancelled WL10250 has no Refund row; report record unavailable rather than inventing one.

7. **Refund/cash evidence is incomplete.** REF-4012 is completed but names BANK_TRANSFER_OR_STORE_CREDIT, not the selected payout rail; WL10245 still has amount_due_at_delivery=1027 despite refunded status. REF-4020 requests 1800 against a 1799 order, matching its goodwill/manual-review note. Preserve; route new over-value payments to human approval and display stored amounts as evidence, not fresh collectible balances.

8. **High-risk scenario versus imported score.** WL10236 has an exact total of 4600, correctly reconciled as 4897 + 49 - 346, but source score 60 is labelled MEDIUM although its scenario expects high risk. Preserve the source score/band/discount. Calculate a separate versioned live score from high value, first-time customer and weak address; the required test must demonstrate HIGH under the documented scoring rules.

9. **Other risk labels lack supporting history.** WL10256 is tagged repeat_customer_low_risk but its customer is_first_time_customer=true and its imported band is MEDIUM. WL10261 claims multiple recent COD orders, but only one order exists for its customer in the supplied set. CUST-1006, CUST-1013 and CUST-1019 are marked first-time while also having prior COD refusals; preserve these signals and flag their ambiguous meaning. Seed claims are not independently observed evidence; do not fabricate prior orders.

10. **Ineligible COD orders.** WL10254 totals 5443; WL10255 uses non-COD pincode 795001. Both have pending COD confirmations. WL10261 also has a pending COD confirmation at non-COD pincode 190001. WL10241 is already in a failed-delivery COD state at that same non-COD pincode. Preserve all four. Eligibility must block new COD acceptance/dispatch and offer prepaid or manual handling; historical in-flight WL10241 requires a visible exception and manual handling rather than a retroactive rewrite. COD eligibility is separate from risk scoring.

11. **Return fixtures are not active returns.** All nine have NONE status and no supplied item ID, requested size, request timestamp, unused/tags declaration or customer consent. Do not count them as submitted returns or execute an exchange from them. RET-3013 has eligible_by_window=false although delivered_days_ago=2; this conflicts with the temporal window (innerwear remains ineligible separately). Preserve that source flag, but recompute eligibility in policy code.

12. **Fictional contacts are not login identities.** All 30 supplied customer emails contain whitespace and fail normal email-format validation. Keep them unchanged in Customer and raw evidence. Create separate valid, fictional demo User identities and explicit mappings; never automatically link accounts on unverified seed email/name. Team registration must be restricted to clearly labelled isolated demo mode or an obvious seeded team account.

13. **No size chart, holiday calendar, conversation history or operational outcomes supplied.** Catalogue size labels do not support recommendations from height/weight. Ask for measurements or hand over instead of inventing sizing advice. Document the working-day calendar assumption. Start conversation analytics empty; do not synthesize historic resolutions, RTO saves, tool calls or LLM costs.

14. **Time-sensitive demo records.** Preserve all source timestamps and relative-day hints. Use an injectable, visible demo clock anchored to 2026-11-12 for imported eligibility scenarios; do not regenerate dates in the seed file. The simulator/clock must advance for new events and short configurable timers, and every queued job must use the same chosen time basis. Tests use a controlled clock. A live-time mode is separately labelled and may change eligibility.

## Import contract

1. Read and hash the original file; validate structure, all key uniqueness, nested keys, arithmetic, actual FK links, owner agreement and declared counts before writing.
2. Treat malformed required data, duplicate IDs and broken required live FKs as errors. Treat the documented historical/scenario conflicts as explicit DataQualityIssue records, not a reason to discard records.
3. Import in a transaction: SeedDataset and policy/pincodes/products/customers, inventory/history, orders/payments/items, shipments/events, source return records, refunds, COD confirmations, demo scenarios and quality issues.
4. Use preserved IDs and deterministic nested keys. The same dataset hash returns an unchanged/no-op report on rerun; it must not reset orders modified during the demo. Fail explicitly on divergent content/ID collisions rather than silently upsert over live data.
5. Preserve the uploaded file byte-for-byte and persist originalText/hash. No deletes, destructive reseeds, timestamp rewriting, forced status corrections or stock deductions.
6. Historical import never fires webhooks, sends messages, calculates fake costs or queues overdue historical reminders. A deliberate UI action starts a fresh demo workflow with deduplicated jobs.
7. Report exact imported/skipped/failed counts and relationship warnings. Assert the counts above against the database before implementing downstream workflows.

## Changes to the master implementation plan

- Retain exactly CUSTOMER and TEAM, but do not let a request parameter grant unrestricted team privileges. Use seeded team access or explicitly gated demo registration.
- Enforce customer ownership as well as order-ID/phone verification. Authentication alone never substitutes for per-order chat verification; the LLM never receives an unverified global order lookup.
- Add explicit exchange creation with item/quantity/size references, stock reservation and one-exchange enforcement. An eligibility tool alone is not the exchange workflow.
- Add grounded policy retrieval, COD-response/payment tools and NDR-rescheduling/RTO tools; the tool list in the master prompt is illustrative, not sufficient by itself.
- Bind explicit customer confirmation to the exact pending mutation, verified order, payload and expiration; consume it atomically once.
- Define NDR-specific courier corrections after dispatch separately from the pre-dispatch address-change tool.
- Persist jobs and notifications with an outbox, deterministic job IDs and transactional webhook claims; HMAC verification happens on raw request bytes before mutation.
- Stop in-flight AI replies/mutations after human takeover using ownership/version checks, not just a disabled frontend input.
- Redact phone/email/address from application logs, audit display and tool telemetry. Protected business records may retain required data, with access control; do not send raw source snapshots to the model.
- LLM/external-call failure should produce a truthful response and callback/human-support option. Repeated failures trigger handover.
- Required 30-case evaluation includes actual multi-turn agent conversations and all 12 Appendix B cases, plus separate policy/risk/idempotency unit tests. Report real failures, grounding, intent/tool/policy accuracy, prompt-injection/data-leak behavior, latency and measured/estimated cost.
- Build database/import/verification/policy tests first, then one complete chat flow, one confirmed exchange/return, COD and prepaid conversion, NDR and human handover. Add dashboard analytics and storefront polish only after these work.
- README, genuine commit history, actual test output and the real 5–7-minute screen recording remain submission work. A generated explainer is not evidence of a working screen-recorded demo; do not claim the video is done until recorded.

## Approval boundary

Proceed with this corrected, lossless mapping and implementation plan. No original record is removed, normalized in place, rewritten to fit a test, or relabelled without an explicit visible derived field. Any newly created demo records must be clearly distinguished from the supplied 30-order dataset.

Source fingerprint: b494fd9ec725a12ae6a937de54b12fa9ba11c0965ac2520b8eb5020f4adac196
