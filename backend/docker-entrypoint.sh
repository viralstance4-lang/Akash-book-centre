#!/bin/sh
set -e

# If a migration is marked as failed in _prisma_migrations, resolve it before deploying.
# This handles the case where a previous deploy partially failed (e.g. idempotent SQL
# ran against columns that already existed from an earlier prisma db push).
npx prisma migrate resolve --rolled-back 20260523000000_add_shiprocket_integration 2>/dev/null || true

npx prisma migrate deploy
node dist/server.js
