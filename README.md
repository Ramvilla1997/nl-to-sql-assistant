# nl-to-sql-assistant

[![CI](https://github.com/Ramvilla1997/nl-to-sql-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Ramvilla1997/nl-to-sql-assistant/actions/workflows/ci.yml)

Ask a business question in plain English and get the SQL that answered it, the rows it returned, and nothing that can change data.

The assistant translates the question into one SQL statement, checks that statement against a strict read-only policy, and runs it under a database role that can only `SELECT` from an allowlist of tables. Each request is wrapped in a `READ ONLY` transaction with a statement timeout.

## Architecture

```mermaid
flowchart LR
  Client -->|POST /api/query| API[Express API]
  API --> Validate[Zod request schema]
  API --> Service[QueryService]
  Service --> Translate{SqlGenerator}
  Translate -->|LLM_PROVIDER=rules| Rules[Fixed SQL for known question shapes]
  Translate -->|LLM_PROVIDER=ollama| Ollama[Local model writes one SELECT]
  Translate --> Guard[validateReadOnlySql]
  Guard -->|rejected| R422[422 with the reason]
  Guard -->|accepted, LIMIT enforced| Exec[Read-only executor]
  Exec -->|BEGIN READ ONLY, statement_timeout| PG[(Postgres)]
  PG -->|role nl_sql_reader: SELECT only| PG
```

Safety comes from two independent layers. Layer one is the validator, which gives specific rejection reasons for users. Layer two is the database itself: the API connects as `nl_sql_reader`, which can only read four tables, and every statement runs in a read-only transaction. The validator can be wrong and the database still refuses the write.

## Quick start

Requires Node.js 20 or later and a Postgres 16 server you can reach.

```bash
npm install

# 1. Create the schema, seed data, and the read-only role (owner connection needed once)
export ADMIN_DATABASE_URL=postgres://<owner>@localhost:5432/postgres
export READER_PASSWORD=$(openssl rand -hex 24)
npm run db:setup

# 2. Run as the read-only role
export DATABASE_URL=postgres://nl_sql_reader:$READER_PASSWORD@localhost:5432/postgres
npm run demo    # ask six questions, then try unsafe SQL against the validator
npm run dev     # API on http://localhost:3000
npm test        # 44 tests; database tests run when DATABASE_URL is set
```

Use a Neon or any other Postgres by setting `ADMIN_DATABASE_URL` for setup and `DATABASE_URL` for the reader role. The schema and grants are plain SQL and work on managed Postgres.

## API

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/health` | - | `{ status, generator }` |
| GET | `/api/tables` | - | `{ tables }` (the allowlist) |
| POST | `/api/query` | `{ question }` | `{ question, sql, columns, rows, rowCount, truncated }` |

```bash
curl -X POST localhost:3000/api/query -H 'Content-Type: application/json' \
  -d '{"question":"Show revenue by month"}'
```

Status codes: `400` for a malformed request, `422` when the question can't be translated or the SQL is rejected (the body explains why), `500` for database failures with no details leaked.

## Demo output

This is the real output of `npm run demo` against the seeded database:

```
Q: How many orders are there?
SQL: SELECT COUNT(*) AS order_count FROM orders LIMIT 100
  order_count: 12

Q: What is the total revenue?
SQL: SELECT ROUND(SUM(quantity * unit_price), 2) AS revenue FROM order_items LIMIT 100
  revenue: 7168.00

Q: Show revenue by month
SQL: SELECT date_trunc('month', o.ordered_at) AS month, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.id GROUP BY 1 ORDER BY 1 LIMIT 100
  2026-01-01  1935.00
  2026-02-01   617.00
  2026-03-01  4616.00

Q: What are the top products?
  Starter License      20 units
  Sensor Kit           12 units
  ...

Q: Delete every order
Rejected: I cannot translate that question yet. Try asking about total revenue, ...

Guardrails: raw SQL that bypasses the question translator
DELETE FROM orders
  -> Generated SQL was rejected: only SELECT statements are allowed
SELECT id FROM orders; DROP TABLE orders
  -> Generated SQL was rejected: only one statement is allowed
SELECT email FROM users
  -> Generated SQL was rejected: table "users" is not allowed
SELECT id FROM orders -- hidden
  -> Generated SQL was rejected: comments are not allowed
```

(The demo prints the tables with `console.table`; the layout is condensed here.)

## What the validator rejects

- More than one statement, and any comments (`--`, `/* */`)
- Anything that is not a `SELECT`, including `WITH` (CTEs are intentionally out of scope)
- Write and admin keywords: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `CREATE`, `GRANT`, `COPY`, `INTO`, `SET`, `pg_sleep`, `dblink`, and others
- Row locking clauses such as `FOR UPDATE`
- Quoted identifiers, which keeps table-name parsing unambiguous
- Any table not in `ALLOWED_TABLES`, including schema-qualified names and comma joins
- Queries with no allowed table, such as `SELECT 1` or set-returning functions

Results are capped at `ROW_LIMIT` rows (default 100). A larger requested `LIMIT` is reduced, and a query without one gets one.

## Configuration

Validated with Zod at startup. The process won't start with a bad value.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | required | Connection string for the `nl_sql_reader` role |
| `ADMIN_DATABASE_URL` | - | Owner connection, used only by `npm run db:setup` |
| `READER_PASSWORD` | - | Password for the reader role during setup |
| `LLM_PROVIDER` | `rules` | `rules` (offline) or `ollama` |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | `localhost:11434` / `qwen2.5-coder:7b` | Local model |
| `ALLOWED_TABLES` | four demo tables | Comma-separated allowlist |
| `ROW_LIMIT` | `100` | Max rows per query (1 to 1000) |
| `STATEMENT_TIMEOUT_MS` | `3000` | Per-query timeout |
| `RATE_LIMIT_PER_MINUTE` | `60` | Per-client limit on `/api` |

## Security

- The API never connects as an owner. `scripts/db/reader-role.sql` grants `SELECT` on the four demo tables only and sets `default_transaction_read_only` and `statement_timeout` on the role.
- Secrets live in environment variables and GitHub Actions secrets. Nothing is committed, and `.env.example` holds placeholders only.
- Helmet, a 16 KB body limit, `x-powered-by` disabled, and rate limiting on `/api`.
- Errors return a safe message. Database errors are logged server-side and never returned to the client.
- CI generates a random reader password for each run, so no credential is stored in the repository.

## Limitations

- The default `rules` translator covers five question shapes. It's deterministic and offline by design, so the demo always runs. The `ollama` translator writes SQL freely but was implemented against Ollama's API and covered by a test for the unreachable-server path. It was not run against a live model here.
- The keyword checks are conservative and sometimes reject harmless text, such as a string literal that contains `do`. Rejections are safe, and the database role is the real guarantee.
- No CTEs or subqueries over unlisted tables. Extending the parser is a deliberate next step, not something the validator silently supports.

## Project layout

```
src/
  config/env.ts            Zod-validated environment
  sql/validate.ts          Read-only SQL policy (layer one)
  sql/generators.ts        Rules and Ollama SQL translators
  db/executor.ts           READ ONLY transaction executor (layer two)
  services/queryService.ts Translate, validate, execute
  routes/, middleware/     HTTP layer
scripts/db/                Schema, seed data, read-only role
scripts/setup-db.sh        One-time database setup
tests/                     Validator, translators, config, database, API
```

## License

MIT
