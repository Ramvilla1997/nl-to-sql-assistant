import { Pool } from 'pg';
import { loadEnv } from '../src/config/env.js';
import { createReadOnlyExecutor } from '../src/db/executor.js';
import { RuleBasedSqlGenerator } from '../src/sql/generators.js';
import { QueryService } from '../src/services/queryService.js';
import { validateReadOnlySql } from '../src/sql/validate.js';

const env = loadEnv();
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 2 });
const service = new QueryService(new RuleBasedSqlGenerator(), createReadOnlyExecutor(pool, env.STATEMENT_TIMEOUT_MS), {
  allowedTables: env.ALLOWED_TABLES,
  rowLimit: env.ROW_LIMIT,
});

const questions = [
  'How many orders are there?',
  'What is the total revenue?',
  'Show revenue by month',
  'What are the top products?',
  'Which customers order the most?',
  'Delete every order',
];

try {
  for (const question of questions) {
    console.log(`\nQ: ${question}`);
    try {
      const answer = await service.ask(question);
      console.log(`SQL: ${answer.sql}`);
      console.table(answer.rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`Rejected: ${message}`);
    }
  }
  console.log('\nGuardrails: raw SQL that bypasses the question translator');
  const unsafe = [
    'DELETE FROM orders',
    'SELECT id FROM orders; DROP TABLE orders',
    'SELECT email FROM users',
    'SELECT id FROM orders -- hidden',
  ];
  for (const sql of unsafe) {
    try {
      validateReadOnlySql(sql, { allowedTables: env.ALLOWED_TABLES, rowLimit: env.ROW_LIMIT });
      console.log(`Accepted (unexpected): ${sql}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${sql}\n  -> ${message}`);
    }
  }
} finally {
  await pool.end();
}
