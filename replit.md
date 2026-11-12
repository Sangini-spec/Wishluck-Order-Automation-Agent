# Wishluck workspace

- Application source: `backend/` (Express/Prisma) and `frontend/` (React/Vite).
- Shared typed contracts and OpenAI client remain under `lib/`.
- Managed service descriptors stay under `artifacts/api-server/.replit-artifact/` and `artifacts/wishluck/.replit-artifact/`; they run the corresponding workspace packages from their new source locations.
- API package `@workspace/api-server`; frontend package `@workspace/wishluck`.
- Use Prisma migrations for the existing PostgreSQL store. Do not use the legacy shared Drizzle package to push schema changes.
- The only seed file is `data/wishluck_seed_data.json`. Do not restore obsolete original-data archives or correction scripts.
- Preserve runtime orders/chats and use marked evaluation fixtures for testing.
- OpenAPI source: `lib/api-spec/openapi.yaml`; regenerate clients after contract changes.
- Root commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm evaluate`.
- Demo messaging, courier and payments are simulations. WhatsApp is not connected.
- Support tickets are an escalation index; all conversation handling belongs in Inbox.
- Uploaded source documents/screenshots and the design sandbox are local-only and ignored by Git.
