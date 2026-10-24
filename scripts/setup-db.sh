#!/usr/bin/env bash
set -euo pipefail

: "${ADMIN_DATABASE_URL:?Set ADMIN_DATABASE_URL to an owner connection string}"
: "${READER_PASSWORD:?Set READER_PASSWORD for the read-only role}"

psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/schema.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/db/seed.sql
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v reader_password="$READER_PASSWORD" -f scripts/db/reader-role.sql

echo "Database ready. Set DATABASE_URL to a connection string for the nl_sql_reader role."
