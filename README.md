# Wishluck — Order Automation Agent

## Live app & demo recording

- **[Open the deployed Wishluck app](https://wishluck-ai-order-operations.replit.app)**
- **[Watch the demo recording](https://drive.google.com/file/d/1qJLIXaLm50ieBF50dJkI0cSKiDP4jlRl/view?usp=drive_link)**

Node.js + React + OpenAI support agent for an Indian apparel store: customer checkout, COD confirmation, failed-delivery follow-up, returns/exchanges, human handover and operational analytics.

All bundled customer details and orders are fictional. Courier events and payments are simulated. Web chat is implemented; WhatsApp and a real courier are not connected.

**Review the executed tests:** [Open the test-results page](docs/test-results.md) · [Backend script output](docs/test-output/backend-tests.txt) · [Detailed actual-agent evaluation](docs/current-agent-evaluation.md)

## The assignment problem and our approach

The assignment asks for an order-support agent that can answer in English, Hindi and Hinglish, use actual order data rather than inventing answers, apply store policies, confirm risky COD orders, recover failed deliveries and hand difficult conversations to a person. The dashboard must make those automations visible and testable.

Our approach is a shared operations backend with two role-based experiences:

- **Customer → Wishluck Store:** a normal shopping experience with catalogue, product detail, cart, checkout, personal orders and support chat. A customer places an order or asks for help here; they do not operate the team's risk or courier controls.
- **Team → Operations Centre:** an order-management workspace for the store's staff. Team members monitor incoming orders, review COD risk, trigger mock courier events, inspect automation, handle escalations through Inbox and review analytics.

Both experiences operate on the **same persisted orders and conversations**. Checkout creates an order that appears in Operations Centre; automation follows up with that customer; a human can take over the same conversation if needed. This avoids a disconnected demo in which staff manufacture every order and the customer never participates.

### Assignment requirements → implementation

| Required capability | Implementation and evidence |
| --- | --- |
| Multilingual order/support chat | Customer web chat, verified order lookup, grounded tool results and English/Hindi/Hinglish replies |
| Returns, exchanges, cancellation and refunds | Code-enforced eligibility, inventory lookup, consent-bound requests and truthful refund-status explanations |
| COD scoring and confirmation | Rule-based score with reasons; four reply options; automatic outreach, reminder and no-response hold |
| Failed-delivery follow-up | Mock courier timeline/events, automatic reason-aware outreach, corrected delivery instructions, refusal/RTO and timed human escalation |
| Human handover | Saved reason, summary, order context, sentiment and suggested reply; AI pauses while the team handles Inbox |
| Operational dashboard and analytics | Order/COD/courier views, Inbox, escalation index, settings and clearly defined outcome/latency/cost metrics |
| Repeat webhook safety | Signature validation, persisted event identity/content checks and deduplicated jobs |
| Seeded data and runnable test script | Prisma seed, preserved active entity IDs, deterministic backend tests and full actual-agent evaluation |

## Our solution — additions and implementation choices

These are our product and engineering choices beyond the minimum assignment, or the specific way we deliver a requested capability. They supplement the mandatory automation; they do not replace it.

| Our addition / choice | Why we added it |
| --- | --- |
| Separate CUSTOMER and TEAM dashboards | Customers shop and ask for help; staff manage order exceptions. Each role sees the appropriate workflow instead of a single all-powerful demo dashboard. |
| Server-side sessions and ownership checks | Customer order/cart/conversation access is scoped to the session's customer ID. Team-only routes are checked on the server, not merely hidden in the UI. Demo access remains explicitly marked. |
| Full customer-led cart and checkout | New customers can register, save their profile/address, choose product variants, submit checkout and create a genuine new runtime order. COD automation starts from that order, not only from a team test button. |
| Checkout reliability and inventory reservation | Server-side totals, stock validation, transactional reservations and idempotent checkout submissions prevent accidental double-ordering and overselling in the demo workflow. |
| A furnished Wishluck Store | Six distinct product photographs, product/variant details, personal order views and checkout make the supplied catalogue usable as a store, rather than six repeated placeholder images. Images are bundled for standalone clones. |
| A single conversation workspace | Inbox owns both AI and team conversation handling. Support tickets show who needed a human and why, with a link back to Inbox, rather than a second competing reply composer. |
| Detailed order page and audit trail | Items, payments, shipping address, shipments, returns/refunds, notes and history give the team one place to understand an order and its changes. |
| Persistent consent records | Changes are proposed before execution. Confirmation, expiry, status rechecks and invalidation on handover prevent stale or unapproved mutations. |
| PostgreSQL-backed queue and mock courier acknowledgements | Follow-ups survive restarts and courier instructions are not reported as completed until the simulated adapter acknowledges them. This implements the automation without requiring a separate Redis service. |
| Shared demo-policy clock | The fictional sample dates remain usable across processes/restarts while real queue deadlines and sessions continue to use elapsed wall time. |
| Evaluation isolation and explicit analytics definitions | Marked test records do not inflate operational metrics; mutation evaluations use cloned orders. AI resolution, team resolution and model-cost estimates are labelled separately. |
| Typed OpenAPI contracts and reproducible reports | Generated clients/validators reduce frontend/backend drift. The report scripts publish per-case evidence and machine-readable results rather than a manually claimed score. |
| Assignment-aligned active seed | Supplied entity IDs are retained while previously authorized fictional-data corrections resolve policy/date inconsistencies. Only the active seed is required; runtime orders and conversations are not reset. |

### Role-based access and the normal user journey

1. A new customer registers as CUSTOMER, completes their profile and opens **Wishluck Store**.
2. They browse the six products, select an available variant, add it to cart and check out with an address and payment choice.
3. The backend validates the request and creates the order. A COD order enters risk assessment and customer confirmation automatically; a simulated prepaid payment is not marked paid before an explicit success result.
4. The customer sees only their own orders and can use chat for tracking, policy, returns/exchanges or delivery help. Order-specific support still requires order-ID/registered-phone verification.
5. Team members open **Operations Centre** to see new orders and exceptions. They do not need to create the customer's normal order themselves.
6. If a delivery fails, automation contacts the customer with the reason. Confirmed delivery corrections go to the mock courier and appear on the order.
7. When a handover rule is met, the conversation moves to human handling in Inbox; automated replies pause. The ticket index records the handover and links to that conversation.

The role picker and password-free demo access are evaluator conveniences, not production identity proof. Production staff accounts would require trusted invitation/provisioning; hiding a dashboard alone is not authorization.

## Repository structure

```text
backend/
  src/                 Express API, agent/tools, policies, queue, tests, evaluator
  prisma/              PostgreSQL schema and versioned migrations
  build.mjs
  package.json
frontend/
  src/                 React customer store and operations dashboard
  public/products/     Six product images, bundled for standalone clones
  package.json
data/
  wishluck_seed_data.json  The single active, assignment-aligned dataset
lib/
  api-spec/            OpenAPI source and code generation
  api-client-react/    Generated typed frontend client
  api-zod/             Generated API validation schemas
  integrations-openai-ai-server/  Shared OpenAI client
  db/                  Shared workspace database package
docs/
  data-model.md
  test-results.md       Clickable executed-test overview
  test-output/         Backend output and shareable machine-readable results
  current-agent-evaluation.md
  ndr-end-to-end-audit.md
artifacts/
  api-server/.replit-artifact/  Replit service configuration only
  wishluck/.replit-artifact/    Replit service configuration only
.env.example
```

Application source lives in `backend/` and `frontend/`. The small artifact descriptors keep Replit Preview and publishing configuration working; they are not duplicate applications. Uploaded assignment documents, screenshots, the unused design sandbox, old data-correction scripts and obsolete seed archives are not part of the current submission tree. Historical Git commits have not been rewritten.

## Stack and design choices

- Node.js 24, Express 5 and TypeScript backend.
- React 19, Vite, Tailwind and TanStack Query frontend.
- Prisma 6 with PostgreSQL for relational data, durable conversations, audit records and transactional order mutations.
- PostgreSQL outbox queue with polling, row leases, dedupe keys and `SKIP LOCKED`. No separate Redis dependency is needed.
- OpenAI function-calling agent (`gpt-5.4-mini`) with schema-validated tools and policy decisions enforced in code.
- Custom server sessions stored in PostgreSQL, HttpOnly cookies and CUSTOMER/TEAM access controls.
- OpenAPI-generated client and server boundary schemas keep API contracts aligned.

## Architecture

```text
Customer: Wishluck Store                 Team: Operations Centre
  catalogue/cart/checkout/chat            orders/COD/courier/Inbox/analytics
                 \                         /
                  React → typed HTTP API
                            |
                    Express API + session
                  role/ownership validation
                            |
             Conversation orchestration + safety guards
                |                         |
        OpenAI tool calling        deterministic policies
                \                         /
                 validated, scoped tool executor
                            |
         PostgreSQL / Prisma transactions and audit records
            |              |                    |
     orders/inventory   conversations/      durable outbox jobs
     returns/payments   consent/handover           |
                                      background worker in API process
                                         |                 |
                                  chat notifications   mock courier adapter
```

The model handles language and tool selection; it is not the source of truth for order state, price, refund amount or eligibility. The API's tools read authoritative records and perform bounded transactional actions. The worker polls due jobs automatically, using persisted leases and dedupe keys so a restart does not discard a reminder.

The assignment's runtime/API, relational database, LLM tools, web chat and testable courier workflows are implemented using the stack above. Prisma, React/Vite, the PostgreSQL queue, custom sessions and OpenAPI generation are our selected implementation technologies, not claims that the assignment mandated those exact libraries.

## Local setup

### Prerequisites

- Node.js 24 and pnpm 10.26.1.
- A reachable PostgreSQL database that you control. Use a separate database for this demo.
- OpenAI API access to `gpt-5.4-mini`, or the configured Replit OpenAI integration.

### Install and configure

Run from the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example backend/.env
```

Edit `backend/.env` privately:

- Set `DATABASE_URL` to your demo PostgreSQL connection.
- Set a strong `SESSION_SECRET`; for example generate one using `openssl rand -hex 32`.
- For a standalone clone, set `OPENAI_API_KEY`.
- On Replit, the existing `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` can be used instead.
- `DEMO_MODE=true` enables fictional demo identities. This is not a production identity-verification system.

Do not put credentials in Git or public test output. LLM calls use your configured provider and may incur usage charges.

### Create schema and seed

```sh
pnpm db:setup
```

This applies the committed Prisma migrations and imports `data/wishluck_seed_data.json`. The seed is idempotent and does not reset runtime orders or conversations; a conflicting dataset hash fails explicitly. No obsolete seed file is required.

### Start

Use two terminals:

```sh
# Terminal 1: API on port 8080, including the automatic queue worker
pnpm dev:backend

# Terminal 2: frontend on port 5173, proxying /api to the backend
pnpm dev:frontend
```

Open `http://localhost:5173`. The API health endpoint is `http://localhost:8080/api/healthz`.

Frontend port defaults to 5173; `PORT` overrides it. `API_PROXY_TARGET` can override the development proxy target. Replit supplies its own service ports and routing through the artifact descriptors.

### Verification commands

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm evaluate
# Generate shareable backend output, then publish the combined results page:
pnpm test:report
pnpm report:publish
```

The evaluator can also be run directly with:

```sh
pnpm --filter @workspace/api-server run evaluate --cases=12,13
```

Tests use the configured demo database and create marked test fixtures; do not run them against a production store. Most backend tests use deterministic tools/policies without model calls. The actual-agent evaluator calls the LLM and has usage costs.

To regenerate API code after editing `lib/api-spec/openapi.yaml`:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Dataset and models

The active dataset contains 30 customers, 6 products, 30 orders, 31 order item lines, 23 inventory rows, 21 shipments, 74 shipment events, 12 return records, 4 refunds and 7 COD confirmation records. Historical return records and serviceability/policy data are also imported.

The data was aligned to the assignment's policy while retaining supplied entity IDs. Only that active dataset is included in `data/`. Provenance metadata inside it does not require an archived file. See [data-model mapping](docs/data-model.md).

No runtime database export or generated test/customer conversations is committed. Application writes persist in PostgreSQL. Product images are included locally and do not require access to another workspace's storage bucket.

## Agent and safety

Customers can ask in English, Hindi or Hinglish. The agent must verify both order ID and registered phone before order-specific disclosure, even for a signed-in customer. Ownership is checked by server-scoped tools.

Tools cover order/shipment lookup, policy, serviceability, inventory, refund status, return/exchange proposals, cancellation, contact changes, COD and NDR. The model cannot override policy or issue payouts.

Mutations are saved as pending proposals and require explicit customer confirmation. Pending actions expire and are invalidated on ownership/status changes or handover. Inventory reservations and releases are atomic and apply only to runtime orders that reserved inventory.

The model has bounded tool rounds, provider timeouts and bounded retries. Repeated tool failures and unresolved/unclear requests are escalated. Logs and tool traces redact contact details. Audits retain actor, time and meaningful before/after changes.

### How a chat request becomes a tool action

1. Persist the customer's message and identify language/intent. Server-side guards intercept obvious prompt-injection, cross-customer disclosure and immediate human/legal requests.
2. Build bounded conversation context and expose only the supported tool schemas to the model.
3. Validate each proposed tool call. Order tools require verified order/phone identity and customer ownership; a plausible-looking order ID is not sufficient.
4. Read the database, policy or mock courier state through tools. Product questions use catalogue facts; missing tracking/ETA or refund completion is not invented.
5. For a write, save a pending action and ask for explicit confirmation. On confirmation, recheck ownership, policy, current order state, stock and action expiry before applying it transactionally.
6. Persist the outcome and redacted tool trace. Reply from actual results, or escalate if the tool fails repeatedly, the request needs review or the agent cannot resolve it safely.

The tool families include customer verification, order/shipment/refund lookup, product and size-stock lookup, policy/serviceability checks, return/exchange eligibility and request creation, cancellation/contact change, COD response and NDR response. A tool creating a return request does **not** mean money has been paid out.

## Policy

- Return within 7 days of delivery, unused with tags.
- No innerwear returns. Sale items permit size exchange only, not refunds.
- One size exchange per item, within 7 days and subject to available inventory.
- Cancellation before dispatch. After shipping, explain refusal/RTO (prepaid refund minus ₹99) or eligible post-delivery return.
- Prepaid refunds use the original payment method; COD requires bank transfer or store credit preference. No bank credentials are collected in chat.
- Refund processing is 5–7 working days after evidenced quality-check completion, not automatically after the request date.
- Refund/goodwill requests over ₹1,500, damage without photos and customers with three recent returns require manual review.
- COD ₹299–₹4,999, ₹49 fee and serviceable pincodes only. Switching to prepaid discounts merchandise by 5%.
- Shipping ₹79 unless merchandise is above ₹999. Delivery windows are estimates after dispatch, not fabricated courier ETAs.

## COD workflow

Customer checkout creates the normal new order. COD risk considers order value, customer history, address completeness, pincode serviceability and recent COD order activity. Each score includes plain-language reasons and adjustable band thresholds.

### Risk signals and score

The risk score starts at zero and is capped at 100:

| Signal | Points | Reason |
| --- | ---: | --- |
| Order value above ₹4,000 | +25 | A failed high-value COD delivery has greater exposure. |
| First-time customer | +20 | There is no established successful-order history. |
| Previous COD refusals | +15 each, capped at +30 | Recorded refusals are direct risk evidence. |
| Weak/incomplete address | +25 | Missing a clear house number/street can prevent delivery. |
| Pincode does not support COD | +25 | The requested payment method cannot be fulfilled there; eligibility also blocks COD separately. |
| More than one COD order within 24 hours | +15 | A burst of COD orders merits additional confirmation. |

Default bands are LOW below 35, MEDIUM from 35 to 64 and HIGH from 65. Team settings can adjust the band thresholds. For example, a first-time customer with a ₹4,600 order and weak address scores 70 before any other signal. The order view shows the reasons, not an unexplained model judgement. We use known pincode serviceability, not invented neighbourhood refusal statistics.

An automatic message offers Confirm, Cancel, Edit address and Pay online. A delayed reminder and no-response hold are configurable. Online payment remains pending until explicit mock success; no real payment is charged. Team test-order creation exists as a secondary evaluator shortcut.

The assignment timings are a confirmation within a minute, one reminder after two hours and a hold after 24 hours without a reply. The queue implements those stages with configurable delays so the demo can use seconds/minutes instead. Confirm moves the order to ready-to-ship; Cancel cancels it; Edit address validates the pincode; Pay online creates a simulated payment flow with the merchandise discount. Free-text replies are handled by the agent.

## NDR and mock courier

The dashboard can trigger Picked up, In transit, Out for delivery, Delivery failed with a reason, Delivered and RTO initiated.

A failure automatically queues customer outreach. Verified customers can supply a retry date within three days, a serviceable corrected address/landmark, alternate phone, or refusal with a reason. After explicit consent, a durable command is acknowledged by the validated mock courier adapter; only then do timeline and order notes show acknowledgement.

Two failed attempts without a customer response trigger timed human handover. A customer clarification is not counted as silence. The API process runs the worker automatically; no manual job execution is needed. See the [three browser-verified scenarios and reproduction steps](docs/ndr-end-to-end-audit.md).

## Human handover and dashboard

Handover covers explicit human requests, legal/social threats, distress, policy review, repeated unresolved requests/tool failures and uncertain intent. It saves a concise grounded summary, order context, mood and editable suggested reply. AI replies pause.

### Handover rules

- Human/support-person requests and legal/consumer-court threats are routed to the team.
- Refund/goodwill over ₹1,500, damage without photos and three recent returns require policy review.
- Default limits are two repeated unresolved signals, two tool failures or two unsuccessful clarification rounds; settings remain bounded by policy safety rules.
- High-distress signals and unresolved uncertainty must not be answered with invented certainty.
- Two failed delivery attempts with no subsequent customer reply trigger the NDR no-response escalation.
- A team member can take over manually. While human handling is active, customer messages remain in the same thread but do not produce competing AI replies.

- **Inbox:** live conversations, tool traces, pending actions, takeover/hand-back, one composer for team replies, suggested drafts and resolution.
- **Support tickets:** read-only escalation index with customer, reason and link back to Inbox.
- **Orders/COD/Courier:** risk explanations, payment/confirmation state, shipment trail and simulation controls.
- **Analytics:** explicit customer-confirmed AI resolution, handover reasons, COD confirmation, distinct orders saved from RTO, first-response time, common requests and an estimated model cost.
- **Settings:** timings, risk thresholds and bounded handover controls.

Analytics excludes marked evaluation fixtures. Initial automated greetings do not count as first responses. Customer-confirmed self-service resolution is distinguished from human resolution. Model costs use a published estimate, not an actual provider/Replit invoice.

## API reliability

The signed courier webhook validates HMAC over raw JSON. Replayed event IDs deduplicate side effects; reusing an ID with changed content is rejected. Dashboard courier controls feed the same workflow using authenticated team access.

The event record is persisted before downstream workflow effects are scheduled. Queue dedupe keys prevent the same event from scheduling duplicate outreach, and transactional checks protect order transitions. This separates a legitimate repeated delivery attempt (a new event) from replaying the same event ID. Mock courier acknowledgements and their instruction state remain visible for audit.

Useful routes include `/api/auth/*`, `/api/conversations`, `/api/conversations/:id/messages`, `/api/orders`, `/api/orders/:id/courier`, `/api/webhooks/courier`, `/api/analytics` and `/api/settings`. The full contract is in OpenAPI.

The demo business-policy clock is shared durably across workers/restarts. Queue deadlines, leases and session TTLs use actual elapsed time.

## Actual evaluation evidence

[Open the test-results page](docs/test-results.md) for the latest actual totals, every backend test, all 33 actual-agent cases and links to the script output. The two suites test different things:

- **Backend tests:** code-level policy, data, privacy/ownership, consent, checkout, webhook, queue, courier and analytics assertions. [Readable runner output](docs/test-output/backend-tests.txt) · [JSON](docs/test-output/backend-tests.json).
- **Actual-agent evaluation:** real model calls, all 12 Appendix B scenarios plus additional cases, expected/observed intent and tools, persisted outcomes, policy, language and grounding. [Detailed report](docs/current-agent-evaluation.md) · [Shareable JSON](docs/test-output/agent-evaluation.json).

An earlier full run was **32/33** because an expired-return refusal used an ambiguous tool reason. The return itself was not approved incorrectly. The tool now distinguishes missing delivery, future delivery and a genuinely expired seven-day window; both affected cases passed their focused recheck. The current full-run result is shown on the linked report page, without combining different runs or changing failed verdicts. Earlier results remain in Git history.

The report records expected/observed intent, tool paths, policy/outcome, grounding/privacy checks, latency and token-cost estimates. Semantic grading is model-assisted and fallible, not an independent human assessment.

Raw generated reports are written under ignored `generated-artifacts/`; shareable output is committed in `docs/`. Run `pnpm test:report`, `pnpm evaluate`, then `pnpm report:publish` to refresh it. The publisher omits conversation/customer identifiers and full chat transcripts from the shareable agent JSON. It preserves actual verdicts, tool paths, grading explanations, timestamps and hashes.

## Known issues and limits

- Courier acknowledgement is simulated; there is no real courier booking or physical delivery.
- Payments are simulated; no real charge or refund is issued.
- Notifications use web chat. Optional WhatsApp test-number integration is not implemented.
- The demo uses fictional identities and should not be exposed as a production customer portal without additional security and operational work.
- Model wording/tool selection may vary; failures and focused rechecks are retained honestly.
- No production deployment is performed by a GitHub push.

## What we would do with more time

1. Connect the optional WhatsApp Cloud API channel with verified webhooks, approved outbound templates, opt-in rules and delivery receipts.
2. Replace mock adapters with a courier provider and payment/refund provider while retaining event deduplication, consent and audit semantics.
3. Harden production identity: trusted team invitations, verified customer identities, rate limiting, stronger account recovery, monitoring and abuse controls.
4. Broaden evaluation with more Hinglish/Hindi variants, ambiguous multi-item requests, concurrent webhook/retry races, provider outages and human-reviewed grading.
5. Add production worker deployment/alerts, dead-letter handling, queue dashboards and operational notification delivery monitoring.
6. Reduce the frontend bundle through route-level splitting and establish repeatable load/accessibility checks.

These are future production improvements, not claims that a mock courier, web-chat-only implementation or the finite tests represent a live commerce service.
