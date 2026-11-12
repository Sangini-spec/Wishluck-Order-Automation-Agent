# WishLuck assignment compliance audit

**Audit date:** 12 November 2026  
**Source:** `attached_assets/AI_AUTOMATION_TAKS_-_ORDER_AI_AGENT_1794479535562.docx`  
**Scope:** Assignment, implementation, recorded agent results, previous checkout verification, repository deliverables and a fresh lightweight read-API timing sample.

No application code, seed records, orders, policies or workflow settings were changed for this audit. The API measurements used a temporary demo-team session, which was logged out afterward. No new LLM evaluation or browser test was run during the audit.

## 1. Verdict

**Keep the architecture and the customer-led shopping improvement. Do not describe the project as fully assignment-complete or submission-ready yet.**

The mandatory Node.js/React stack is correct. PostgreSQL, Prisma, Vite, OpenAI tool calling and the PostgreSQL outbox queue are legitimate choices under the assignment. Redis/BullMQ, Next.js, Shopify and WhatsApp are not mandatory.

The implementation contains real, connected support, COD, courier, NDR and team workflows. However, some requirements are only partially implemented, some measurements do not prove the claims they might appear to prove, and several required submission items are missing.

Status meanings:

- **Implemented:** An actual code path exists; this does not imply exhaustive verification.
- **Partial:** A usable implementation exists but an explicit requirement or important case is missing.
- **Missing:** No corresponding implementation/deliverable was found.
- **Evidence gap:** Implementation may work, but current evidence does not establish the required result.

## 2. Tech-stack comparison

| Assignment requirement | Current implementation | Assessment |
|---|---|---|
| Node.js backend; Express/Fastify/NestJS allowed | Node.js, Express 5, TypeScript | Aligned. TypeScript is a plus in the brief. |
| React frontend; Vite/Next.js allowed | React, Vite, TypeScript | Aligned. Next.js is not required. |
| Any LLM using tool/function calling | OpenAI-compatible client through Replit AI Integrations; function definitions and a tool loop | Aligned. The assignment does not mandate a particular provider/model. |
| PostgreSQL/MongoDB/SQLite or another DB | PostgreSQL with Prisma models/migrations | Aligned. Unused template Drizzle dependencies do not make Drizzle the active order database. |
| BullMQ or anything similar | Persistent PostgreSQL outbox jobs, due times, claim leases, SKIP LOCKED, retry/backoff, dedupe keys | Reasonable permitted alternative; not itself a compliance gap. Concurrency hardening remains advisable. |
| REST APIs and webhooks | Express routes and HMAC order/courier webhook entry points | Implemented. Endpoint naming may differ from the example. |
| SSE or WebSocket live inbox | SSE invalidation with polling fallback | Aligned. |
| Web chat required | Customer chat widget and team inbox | Implemented. |
| Sample seeded store or Shopify dev store | Seed importer, fictional source records and preserved original upload | Aligned. Shopify is optional. |
| Environment variables for keys | Environment-based configuration and `.env.example` | Correct configuration approach. This audit is not a full Git-history secret scan. |
| Separate `backend/` and `frontend/` folders in submission | Workspace packages in `artifacts/api-server/` and `artifacts/wishluck/` | Logically separated, but not the literal requested submission layout. Prepare a compliant export/layout without breaking artifact routing. |

Evidence: package manifests, `src/app.ts`, `src/lib/agent.ts`, `src/lib/queue.ts`, `prisma/schema.prisma`, `.env.example`, README.

## 3. Workflow comparison

### A. Customer support

| Requirement | Assessment | Evidence / gap |
|---|---|---|
| English, Hindi and Hinglish | Partial | Model instructions and language detection exist. Several server-generated greetings, handover notices, COD messages and consent/results are English or mixed-language; pure Hindi is not consistently preserved. |
| Verify order ID plus registered phone before chat disclosure | Implemented | `verify_customer`, conversation/order/phone scope and a 30-minute verification window are enforced server-side. |
| Tool-sourced order/shipment/refund/stock facts | Implemented with evidence limitation | Validated lookup tools exist. Final natural-language grounding relies on model instructions, not a comprehensive output verifier. |
| Order status, courier status, ETA, tracking | Implemented where recorded | Seed shipments expose real stored mock data. New shipments have no calculated ETA; unshipped orders honestly report no tracking/ETA. The literal Appendix B1 fixture is mismatched; see section 5. |
| Cancellation and return eligibility in code | Implemented | `policy.ts` is deterministic; tools cannot override mutation guards. |
| Explicit consent before cancellation/address/return mutation | Implemented in chat | Prepared, expiring actions are applied only after an explicit affirmative reply, with ownership/state rechecks. Customer COD cancellation also has a confirmation dialog. |
| Return/exchange with stock and one exchange per item | Partial | Single-unit requests exist. Quantity selection is absent; historical exchange counts are taken across the order rather than matched to the exact item. This matters for multi-item/multi-unit checkout orders. |
| Customer chooses COD refund bank transfer or store credit | Missing from request flow | The policy text describes the choice, but no structured refund-method selection is collected/persisted in the return tool schema/request. A real bank integration is not required to fix this. |
| Prepaid refund policy and status | Partial | Reads actual refund records and states 5–7 working days after QC. No fabricated payment is made. Automatic QC/refund settlement is not explicitly required by the assignment, but a consistent request/preference lifecycle is needed. |
| Address and phone changes before dispatch | Implemented | Validated preparation, serviceability checks and explicit consent. Post-dispatch changes use NDR. |
| Catalogue/size help without guessing | Safe limitation | Catalogue facts and stock exist. No measurement chart was supplied; refusing to invent height/weight-based sizing is correct. An authored, clearly identified chart could improve coverage. |
| Prompt injection and cross-customer privacy | Implemented guardrails; limited adversarial evidence | Ownership checks, pre-model refusals and the absence of a payout tool are strong protections. A few exact phrase tests do not prove general resistance to every attack. |
| Tool/provider failures produce a truthful response | Implemented | Error results, callback/person offers and repeated-error escalation exist. |

Primary evidence: `agent.ts:11–39, 41–86, 93–150, 151–209`; `policy.ts`.

### B. COD confirmation and RTO risk

**Implemented:**

- Dashboard test-order and signed order-webhook ingestion.
- Customer checkout as an additional natural order source.
- Explainable 0–100 score from value, first-time status, refusals, address quality, pincode support and recent COD orders.
- Four customer choices, confirmation status, ready-to-ship transition, cancellation, address correction and pending prepaid conversion.
- Additional 5% merchandise discount and removal of the COD fee on simulated prepaid conversion.
- Persistent confirmation/reminder/hold jobs, defaults of 7,200 / 86,400 seconds, editable shorter timings.
- Dispatch guard against unconfirmed COD and unpaid prepaid orders.
- Customer messages and Operations updates occur without a team member manually starting new checkout orders.

**Gaps / qualifications:**

1. The rules and their weights are understandable but weights are hardcoded; Settings edits band thresholds, not all score signals. This is acceptable for the stated simple rules-based score; configurable handover rules are a separate mandatory gap.
2. A one-second polling interval is designed to send promptly, and previous browser verification showed automatic arrival. No load/restart SLA benchmark proves all notifications meet the deadline.
3. COD queue jobs read pending state and later write without taking the same order lock as customer responses. A reminder/hold racing with confirmation could use stale state. This is a code-level concurrency risk, not a reproduced failure from this audit.
4. Standard chat cancellation and COD-specific cancellation do not have identical cleanup paths for pending conversion attempts. State/queue/payment cleanup should be unified.

Evidence: `operations.ts:15–22, 64–83, 85–136, 157–185`; `checkout.ts`; `queue.ts`.

### C. Failed delivery / NDR

**Implemented:**

- All six requested courier events, failed-delivery reasons and shipment timelines.
- Team-triggered events and signed/deduplicated courier webhooks.
- An immediate durable customer-outreach job with the courier's reason.
- Verified, consent-bound retry/date/address/landmark/alternate-phone/refusal instructions.
- Retry-date validation within the next three days.
- Stored NDR response, shipment timeline entry, order notes and refusal/RTO-request state.
- Escalation when the unanswered case has two failed attempts.

**Partial courier hand-back:**

The code says instructions were sent to the mock courier, but the implementation records them in local NDR JSON, a shipment event and notes. There is no distinct validated courier instruction API/adapter with an acknowledgement and retry failure path. An internal mock adapter is sufficient; no paid or real courier integration is needed.

Additional issues:

- `submit_ndr_response` validates the retry date before preparing consent, but does not revalidate its three-day window when consent is later applied.
- Old awaiting cases are not comprehensively closed when a later delivery succeeds; a delayed check can still be working from an outdated awaiting case.
- The NDR follow-up Settings label implies delayed initial contact, but initial contact is queued immediately; that setting actually controls the unanswered-case escalation check.

Evidence: `agent.ts:75–82, 120–129`; `operations.ts:157–185`; `queue.ts`.

### D. Human handover and dashboard

| Requirement | Assessment | Detail |
|---|---|---|
| Human request, distress, legal/social threats | Implemented, partly model/regex-dependent | English hard guards plus LLM handover instructions. Multilingual intent/handover coverage needs stronger tests. |
| Refund/goodwill > ₹1,500; manual review | Partial | Explicit amount requests and deterministic return review exist. Multi-unit refund value and preferred method are incomplete. |
| Same issue unresolved twice | Partial | Counts tool failures within a run/provider error runs; no persisted same-issue failed-resolution counter across turns. |
| Uncertain intent | Partial | Prompt asks for clarification/escalation; no explicit cross-turn clarification budget. |
| Stop AI during human ownership | Implemented | Conversation status/version guards also suppress in-flight AI replies. |
| Ticket summary, mood, order details, suggested reply | Partial | Fields and team editing exist, but fallback summaries and suggested replies are generic, and mood is a coarse keyword classification. |
| Live inbox, full conversation, tool trace, handover reason | Implemented | Role-scoped routes, SSE/polling, tool input/output/status/duration. |
| Orders/COD/courier controls | Implemented | Customer checkout adds a useful origin, while the required test-order shortcut remains. |
| Analytics | Partial | All requested categories have a representation, but definitions/scoping need correction; see section 4. |
| Settings: timings, risk thresholds, handover rules | Partial | Timings and thresholds work; handover rules remain hardcoded. |
| Error/empty states; desktop/tablet | Implemented UI; tablet evidence gap | Desktop and phone checkout were previously checked. No dedicated tablet acceptance run was evidenced in this audit. |

Evidence: `operations.ts:49–57`; `agent.ts:158–204`; `routes/wishluck.ts:140–177, 180–198`; `pages/ops/settings.tsx`.

## 4. Analytics and backend reliability gaps

1. **AI resolution percentage is not yet a reliable business metric.** It counts resolved conversations without a ticket. No agent/customer self-service resolution event was found; the exposed resolve action is team-only. An answered chat can remain AI_HANDLING indefinitely and never enter that denominator.
2. **Some evaluation fixtures can affect operational metrics.** Several analytics queries filter `isEvaluation`, but `pendingCod` and `rtoSaved` do not consistently apply that filter. RTO saved counts NDR cases rather than distinct orders.
3. **Common requests are a last-message heuristic.** Each message overwrites the conversation's intent using English keyword patterns. It is not an independently measured intent classifier, especially for Hindi.
4. **Audit rows do not consistently contain changed field values.** For several mutations the new value is a success message/reference, not the changed phone/address/payment/NDR state. Sensitive values should remain protected, but a meaningful masked before/after change set is still needed.
5. **No whole-turn LLM deadline.** A provider call has a 30-second timeout and two retries, and the agent can take eight rounds. The 120-second conversation busy lease can expire before the worst-case turn is finished. Normal measured responses were much faster; this is a failure-path risk.
6. **Read API query fan-out.** Orders and dashboards make per-order risk/settings/pincode/payment/audit-related queries; the conversation list fetches full messages/tool history per conversation. Fine for this sample, not evidence of scale. Pagination, batched aggregates and smaller list DTOs would be sensible later.

Evidence: `analytics.ts:11–23`; `routes/wishluck.ts:140–164`; `operations.ts:24–37`; `agent.ts:154, 182–207`.

## 5. Appendix B traceability

| Case | Current coverage | Assessment |
|---|---|---|
| B1 correct phone for WL10234 → courier status/ETA | Actual model case verifies and truthfully reports unshipped/no shipment | **Fixture/expected-result deviation.** The evaluator intentionally expects “no shipment,” unlike the brief's courier-status/ETA expectation. Do not invent an ETA. Reconcile the fixture/mapping explicitly, while preserving an unshipped case elsewhere. |
| B2 wrong phone | Actual model case and server verification | Covered, within limited test evidence. |
| B3 Hinglish exchange, L stock, consent | Actual model eligibility/consent case; mutation code exists | Conversation evaluator does not complete the affirmative-consent exchange journey. |
| B4 briefs rejected | Actual model case and policy logic | Covered. |
| B5 sale refund rejected, exchange offered | Actual model case and policy logic | Covered, but broad keyword assertions do not prove every detail of the reply. |
| B6 shipped cancellation rejected | Actual model case and cancellation guard | Covered. |
| B7 ₹4,600 / near Shiv mandir / first customer | Named backend integration test and corrected fixture | Operational test exists, but is outside the 30-conversation report. |
| B8 failed delivery → contact → date → courier update | Named backend integration test | Operational test exists, but is outside the 30-conversation report; courier hand-back is local persistence. |
| B9 injection, no tool | Actual model-run harness case using deterministic pre-model guard | Covered exact attack. It does not prove generalized adversarial safety. |
| B10 another customer's orders | Exact guard case plus cross-customer verification case | Covered exact cases. |
| B11 consumer court → ticket | Actual harness case using handover guard | Ticket exists; summary/reply quality remains partial. |
| B12 non-COD 795001 | Actual tool-calling case | Covered. |

The task asks for at least 30 conversations including the twelve Appendix B cases. The current 30-chat report plus separate B7/B8 tests is useful engineering coverage, but the required unified submission report should explicitly include and score those event-driven cases too.

## 6. Performance and verification evidence

### A. Existing recorded agent evaluation — historical, not rerun

Recorded at **2026-11-12 09:28:05 UTC**, before the authorized seed correction and the later checkout changes:

| Measure | Recorded value |
|---|---:|
| Cases | 30 |
| All declared assertions passed | 29/30 |
| Expected-tool checks | 96.67% |
| Keyword outcome checks | 100% |
| Mean full-case duration | 2,585 ms |
| Median full-case duration | 2,211 ms |
| 95th-percentile full-case duration, nearest-rank | 9,672 ms |
| Maximum full-case duration | 10,569 ms |
| Input / output tokens | 89,249 / 2,650 |
| Reported run errors | 0 |
| Monetary LLM cost | Not calculated |

The failed case correctly rejected an unavailable exchange, but missed the harness's separate `check_inventory` tool expectation; the eligibility tool itself reads stock.

Important limitations:

- The report does **not** measure independent semantic intent accuracy.
- “100% keyword outcome checks” does **not** mean 100% policy accuracy.
- The grounding check detects only some unsupported rupee amounts; it does not validate invented dates, ETA, status, tracking URLs or every sentence. User-supplied amounts are allowed by that check, which is weaker than tool grounding.
- Several safety cases are resolved by deterministic guards rather than a model call.
- The script lacks a dedicated expected-intent field.
- It is not a clean current-dataset regression result.
- Required rough monetary cost per chat is missing. Token usage is honest but not a substitute for a documented cost estimate.
- The evaluator overwrites its report files without itself preserving the before-correction warning that was added to the current documentation.

Source: `generated-artifacts/agent-evaluation.json`, `docs/agent-evaluation.md`, `src/evaluate.ts:7–57`.

### B. Existing automated/browser verification

The preceding implementation round passed **55 backend tests** and type checks. The README still says 54 and needs updating when the submission is prepared.

Previous signed-in browser verification demonstrated:

- New customer registration, multi-item persistent bag, checkout and bag clearing.
- Automatic COD outreach; customer confirms; the same order and score appear in Operations.
- Prepaid stays pending until explicit simulated success, then remains paid after reload.
- Saved-profile prefill was fixed and rechecked.
- No page-level overflow on the tested 390-pixel cart view.

These checks establish specific working paths, not a complete proof of the agent's multilingual, NDR, handover and return behavior on the final dataset.

### C. Fresh read-API timings during this audit

One warm-up and five sequential measured requests per route, through the development HTTPS gateway, with the current small dataset:

| Route | HTTP statuses | Median | Range | Response size |
|---|---|---:|---:|---:|
| `/api/orders` | All 200 | 47 ms | 45–64 ms | 60,029 bytes |
| `/api/conversations` | All 200 | 13 ms | 11–17 ms | 1,743 bytes |
| `/api/analytics` | All 200 | 14 ms | 12–15 ms | 644 bytes |
| `/api/dashboard` | All 200 | 62 ms | 58–67 ms | 12,338 bytes |

This is a **small, warm, single-user development sample**. It is not a load test, browser render benchmark, production latency guarantee, fresh LLM benchmark or notification delivery SLA test.

Current operational defaults were read as 7,200-second COD reminder, 86,400-second COD hold, 120-second NDR check and medium/high thresholds of 35/65.

## 7. Submission checklist

| Required item | Current position |
|---|---|
| GitHub/GitLab URL and meaningful history | Local Git has five commits; only an internal backup remote was found. No submission-hosted repository URL was found. |
| Literal `backend/` and `frontend/` folders | Missing literal layout; packages are logically separate in Replit artifact directories. |
| `.env.example` | Present with placeholder values. |
| Appendix A seed script | Present, with corrected active seed and immutable original reference. |
| README setup/architecture/tools/policy/risk/queue/limitations | Present, but some content/test counts/walkthrough claims are stale. Standalone local setup needs clearer gateway/port guidance and environment-variable loading outside Replit. |
| Output of agent tests | Present, but historical, incomplete in the ways described above and missing monetary cost. |
| 5–7 minute recording with all specified demonstrations | No finished submission recording was found. Browser-test screenshots/clips are not that complete walkthrough. |
| Live deployed link | Optional. Development preview is not proof of a published deployment. |

Not required for baseline completion: WhatsApp, Shopify, voice notes, Docker, real courier/payment services, or an LLM cost dashboard. **The rough cost estimate in the test report is required even though a dashboard cost view is a bonus.**

## 8. Deviations worth keeping

1. **Customer-led cart/checkout:** A coherent improvement over relying solely on team test orders. It exercises real order creation, ownership, pricing, inventory and automation. Keep the evaluator shortcut because the assignment explicitly requests it.
2. **PostgreSQL durable queue:** Meets the permitted “similar” queue choice and simplifies infrastructure. Harden its state/concurrency behavior instead of replacing it merely to match BullMQ by name.
3. **Code-owned policy and consent:** Correct architecture; preserve it.
4. **Truthful missing-data behavior:** Do not invent ETA, refund dates or size charts. Fix fixture coverage and evidence instead.
5. **Simulated payment/courier and web messaging:** Appropriate to the assignment. Do not add paid integrations just to complete a mock workflow.
6. **Preserved original dataset and explicit corrected active seed:** Appropriate under the user's authorization; do not reset runtime records to prepare the submission.

## 9. Recommended next implementation order

This is a recommendation, not an approved implementation or queued project task.

### Priority 1 — complete the core assignment behavior

- Add persisted handover settings, including hard-required manual-review safeguards, and same-issue unresolved-twice tracking.
- Complete the mock courier instruction adapter/acknowledgement path and NDR lifecycle/consent-time validation.
- Add return quantity and refund-method preference; use the requested, policy-correct refundable amount for review thresholds and per-item exchange history.
- Make deterministic replies/outreach/handover respect the customer's language consistently.
- Store useful protected/masked before/after audit change sets and unify COD cancellation/payment/job cleanup and queue locking.

### Priority 2 — make the results credible

- Define self-service resolution and the analytics denominators; consistently exclude evaluation fixtures and count saved orders distinctly.
- Reconcile Appendix B1, include B7/B8 in one traceable report, and complete affirmative-consent mutation journeys in tests.
- Strengthen fact-grounding/negative assertions and intent evaluation.
- Run the final 30+ case suite against the final corrected dataset; publish failures, latency distribution, measured tokens and a documented monetary estimate.
- Add targeted failure/race/restart coverage and a tablet acceptance check.

### Priority 3 — prepare the submission

- Produce the literal folder layout or compliant export with reproducible local setup.
- Refresh README and keep reports tied to the evaluated revision/dataset.
- Provide the GitHub/GitLab repository and meaningful history.
- Record the actual 5–7 minute demonstration covering every requested flow.

**Bottom line:** The product direction and core stack are sound. Finish the mandatory behavior, evaluation and packaging gaps before adding optional integrations or claiming full completion.
