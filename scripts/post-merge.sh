#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server exec prisma generate
pnpm --filter @workspace/api-server exec prisma migrate deploy
