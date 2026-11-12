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

- Preserve source records verbatim, including contradictions. Never rewrite the 30 imported orders merely to make tests pass.
- Use an advancing 2026-11-12 demo clock for imported policy scenarios; job delays use real elapsed seconds for short test timings.
- Source returns with status NONE are not active requests. Real actions require verified order scope and atomic single-use consent.
- Demo TEAM access is intentional only in isolated demo mode/development, never granted by merely selecting a role in the UI.

## Product

- Customers can browse six products, inspect own orders, manage new-account profiles and chat in English/Hindi/Hinglish.
- The team can review live chats and tool traces, take over, inspect source warnings and risk, simulate COD/courier events and configure timing settings.

## User preferences

- The uploaded assignment is authoritative; import all seed JSON entities and preserve every source ID, field and contradiction.

## Gotchas

- Seed customer emails are intentionally invalid; authentication identities are separate.
- WL10236 is ₹4,600 with a MEDIUM *source* risk band. Live scoring is separate; do not silently relabel it.
- `generated-artifacts/` is ignored; record the evaluation summary in `docs/agent-evaluation.md`.

## Pointers

- See `README.md` for full setup, security, exact record counts and evaluation limitations.
