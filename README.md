# Wishluck — Order Automation Agent

Node.js + React + OpenAI support agent for an Indian apparel store: customer checkout, COD confirmation, failed-delivery follow-up, returns/exchanges, human handover and operational analytics.

All bundled customer details and orders are fictional. Courier events and payments are simulated. Web chat is implemented; WhatsApp and a real courier are not connected.

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

Do not put credentials in Git or in the demo recording. LLM calls use your configured provider and may incur usage charges.

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

## Policy

- Return within 7 days of delivery, unused with tags.
- No innerwear returns. Sale items permit size exchange only, not refunds.
- One size exchange per item, within 7 days and subject to available inventory.
- Cancellation before dispatch. After shipping, explain refusal/RTO or eligible post-delivery return.
- Prepaid refunds use the original payment method; COD requires bank transfer or store credit preference. No bank credentials are collected in chat.
- Refund processing is 5–7 working days after evidenced quality-check completion, not automatically after the request date.
- Refund/goodwill requests over ₹1,500, damage without photos and customers with three recent returns require manual review.
- COD ₹299–₹4,999, ₹49 fee and serviceable pincodes only. Switching to prepaid discounts merchandise by 5%.
- Shipping ₹79 unless merchandise is above ₹999. Delivery windows are estimates after dispatch, not fabricated courier ETAs.

## COD workflow

Customer checkout creates the normal new order. COD risk considers order value, customer history, address completeness, pincode serviceability and recent COD order activity. Each score includes plain-language reasons and adjustable band thresholds.

An automatic message offers Confirm, Cancel, Edit address and Pay online. A delayed reminder and no-response hold are configurable. Online payment remains pending until explicit mock success; no real payment is charged. Team test-order creation exists as a secondary evaluator shortcut.

## NDR and mock courier

The dashboard can trigger Picked up, In transit, Out for delivery, Delivery failed with a reason, Delivered and RTO initiated.

A failure automatically queues customer outreach. Verified customers can supply a retry date within three days, a serviceable corrected address/landmark, alternate phone, or refusal with a reason. After explicit consent, a durable command is acknowledged by the validated mock courier adapter; only then do timeline and order notes show acknowledgement.

Two failed attempts without a customer response trigger timed human handover. A customer clarification is not counted as silence. The API process runs the worker automatically; no manual job execution is needed. See the [three browser-verified scenarios and reproduction steps](docs/ndr-end-to-end-audit.md).

## Human handover and dashboard

Handover covers explicit human requests, legal/social threats, distress, policy review, repeated unresolved requests/tool failures and uncertain intent. It saves a concise grounded summary, order context, mood and editable suggested reply. AI replies pause.

- **Inbox:** live conversations, tool traces, pending actions, takeover/hand-back, one composer for team replies, suggested drafts and resolution.
- **Support tickets:** read-only escalation index with customer, reason and link back to Inbox.
- **Orders/COD/Courier:** risk explanations, payment/confirmation state, shipment trail and simulation controls.
- **Analytics:** explicit customer-confirmed AI resolution, handover reasons, COD confirmation, distinct orders saved from RTO, first-response time, common requests and an estimated model cost.
- **Settings:** timings, risk thresholds and bounded handover controls.

Analytics excludes marked evaluation fixtures. Initial automated greetings do not count as first responses. Customer-confirmed self-service resolution is distinguished from human resolution. Model costs use a published estimate, not an actual provider/Replit invoice.

## API reliability

The signed courier webhook validates HMAC over raw JSON. Replayed event IDs deduplicate side effects; reusing an ID with changed content is rejected. Dashboard courier controls feed the same workflow using authenticated team access.

Useful routes include `/api/auth/*`, `/api/conversations`, `/api/conversations/:id/messages`, `/api/orders`, `/api/orders/:id/courier`, `/api/webhooks/courier`, `/api/analytics` and `/api/settings`. The full contract is in OpenAPI.

The demo business-policy clock is shared durably across workers/restarts. Queue deadlines, leases and session TTLs use actual elapsed time.

## Actual evaluation evidence

[Current recorded evaluation](docs/current-agent-evaluation.md) retains an actual full run of **32/33**, followed by passing focused rechecks of cases 12 and 13 after a denial-wording correction. This is not represented as a single 33/33 full run. All 12 Appendix B cases were included.

The report records expected/observed intent, tool paths, policy/outcome, grounding/privacy checks, latency and token-cost estimates. Semantic grading is model-assisted and fallible, not an independent human assessment.

Raw generated reports are written under ignored `generated-artifacts/`; the shareable evaluation summary is committed in `docs/`. Moving folders does not retroactively change the recorded run's timestamp or code hash.

## Limits and submission status

- Courier acknowledgement is simulated; there is no real courier booking or physical delivery.
- Payments are simulated; no real charge or refund is issued.
- Notifications use web chat. Optional WhatsApp test-number integration is not implemented.
- The demo uses fictional identities and should not be exposed as a production customer portal without additional security and operational work.
- Model wording/tool selection may vary; failures and focused rechecks are retained honestly.
- The required 5–7 minute screen recording has not been produced by this repository cleanup.
- No production deployment is performed by a GitHub push.
