# WishLuck AI Order Operations

Fictional evaluator app: a customer storefront/chat and team order-operations center with a shared Node.js API and lossless seed data.

## Run & Operate

- Web workflow: `artifacts/wishluck: web` (`/`); API workflow: `artifacts/api-server: API Server` (`/api`).
- `pnpm --filter @workspace/api-server exec prisma generate --schema prisma/schema.prisma` then `pnpm --filter @workspace/api-server exec prisma migrate dev --schema prisma/schema.prisma` for an empty development database.
- `pnpm --filter @workspace/api-server run db:seed` idempotently imports the entire unmodified JSON and demo identities.
- `pnpm --filter @workspace/api-spec run codegen` after changing the API contract; `pnpm run typecheck` checks all packages.
- `pnpm --filter @workspace/api-server run test` and `pnpm --filter @workspace/api-server run evaluate` exercise policies/webhooks/workflows and 30 real LLM conversations.
- Required runtime env: managed `DATABASE_URL`, `SESSION_SECRET` for webhook protection, Replit AI Integrations OpenAI variables. Optional `WEBHOOK_SECRET` and `DEMO_MODE`.

## Stack

- pnpm workspaces, Node.js 24, React/Vite, Express 5, TypeScript, PostgreSQL + Prisma, Zod, Orval and esbuild.
- Operational jobs use a durable PostgreSQL outbox with leases, retries and deduplication instead of a separate Redis deployment.

## Where things live

- Frontend: `artifacts/wishluck/src/`; backend: `artifacts/api-server/src/`.
- Schema/migrations: `artifacts/api-server/prisma/`; source JSON: `data/wishluck_seed_data.json`.
- OpenAPI: `lib/api-spec/openapi.yaml`; generated hooks: `lib/api-client-react/`.
- Architecture, demo flow and known limits: `README.md`; data audit: `docs/schema-and-data-audit.md`; agent results: `docs/agent-evaluation.md`.

## Architecture decisions

- The user authorized assignment-aligned corrections. Use the corrected active seed; retain the exact original separately. Do not show recurring seed-error commentary in the interface or reset runtime activity when applying corrections.
- Use an advancing 2026-11-12 demo clock for imported policy scenarios; job delays use real elapsed seconds for short test timings.
- Source returns with status NONE are not active requests. Real actions require verified order scope and atomic single-use consent.
- Demo TEAM access is intentional only in isolated demo mode/development, never granted by merely selecting a role in the UI.

## Product

- Customers can browse six products, inspect own orders, manage new-account profiles and chat in English/Hindi/Hinglish.
- The team can review live chats and tool traces, take over, inspect source warnings and risk, simulate COD/courier events and configure timing settings.

## User preferences

- The assignment is authoritative. Preserve every original entity ID and the archived upload, while correcting demo inconsistencies in the active data.

## Gotchas

- Corrected fictional contact emails and authentication identities remain separate; never auto-link accounts on email/name.
- WL10236 is exactly ₹4,600, with “near Shiv mandir” and HIGH risk to match the assignment.
- `generated-artifacts/` is ignored; record the evaluation summary in `docs/agent-evaluation.md`.

## Pointers

- See `README.md` for full setup, security, exact record counts and evaluation limitations.
