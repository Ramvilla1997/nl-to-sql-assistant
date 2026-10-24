import { Pool } from 'pg';
import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createReadOnlyExecutor } from './db/executor.js';
import { OllamaSqlGenerator, RuleBasedSqlGenerator, type SqlGenerator } from './sql/generators.js';
import { QueryService } from './services/queryService.js';

const env = loadEnv();

const pool = new Pool({ connectionString: env.DATABASE_URL, max: 5 });

const generator: SqlGenerator =
  env.LLM_PROVIDER === 'ollama'
    ? new OllamaSqlGenerator(env.OLLAMA_BASE_URL, env.OLLAMA_MODEL)
    : new RuleBasedSqlGenerator();

const service = new QueryService(generator, createReadOnlyExecutor(pool, env.STATEMENT_TIMEOUT_MS), {
  allowedTables: env.ALLOWED_TABLES,
  rowLimit: env.ROW_LIMIT,
});

const server = createApp({ env, service }).listen(env.PORT, () => {
  console.log(`nl-to-sql-assistant listening on port ${env.PORT} (generator: ${generator.name})`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, closing server`);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
