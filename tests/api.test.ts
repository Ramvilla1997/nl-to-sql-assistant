import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import type { QueryExecutor } from '../src/db/executor.js';
import { RuleBasedSqlGenerator } from '../src/sql/generators.js';
import { QueryService } from '../src/services/queryService.js';

/** Test double: records the SQL it receives and returns a fixed result set. */
function buildApp() {
  const executor: QueryExecutor = {
    run: async () => ({ columns: ['order_count'], rows: [{ order_count: 12 }] }),
  };
  const service = new QueryService(new RuleBasedSqlGenerator(), executor, {
    allowedTables: ['customers', 'orders', 'order_items', 'products'],
    rowLimit: 100,
  });
  return createApp({ env: { RATE_LIMIT_PER_MINUTE: 1000 }, service });
}

describe('HTTP API', () => {
  it('reports health', async () => {
    const response = await request(buildApp()).get('/api/health');
    expect(response.body).toEqual({ status: 'ok', generator: 'rules' });
  });

  it('answers a supported question with the SQL that was run', async () => {
    const response = await request(buildApp())
      .post('/api/query')
      .send({ question: 'How many orders are there?' });
    expect(response.status).toBe(200);
    expect(response.body.sql).toBe('SELECT COUNT(*) AS order_count FROM orders LIMIT 100');
    expect(response.body.rows).toEqual([{ order_count: 12 }]);
    expect(response.body.truncated).toBe(false);
  });

  it('returns 422 with the rejection reason for an unsupported question', async () => {
    const response = await request(buildApp())
      .post('/api/query')
      .send({ question: 'Delete all the orders please' });
    expect(response.status).toBe(422);
    expect(response.body.error).toContain('I cannot translate that question yet');
  });

  it('returns 400 for an invalid body', async () => {
    const response = await request(buildApp()).post('/api/query').send({ question: 'x' });
    expect(response.status).toBe(400);
  });

  it('lists only the allowlisted tables', async () => {
    const response = await request(buildApp()).get('/api/tables');
    expect(response.body.tables).toEqual(['customers', 'orders', 'order_items', 'products']);
  });
});
