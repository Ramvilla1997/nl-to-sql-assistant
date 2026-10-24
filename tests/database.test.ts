import { afterAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createReadOnlyExecutor } from '../src/db/executor.js';

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)('read-only database execution (requires DATABASE_URL for the reader role)', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  const executor = createReadOnlyExecutor(pool, 3000);

  afterAll(async () => {
    await pool.end();
  });

  it('runs a SELECT against the seeded data', async () => {
    const result = await executor.run('SELECT COUNT(*) AS n FROM orders');
    expect(Number(result.rows[0]?.n)).toBeGreaterThan(0);
  });

  it('refuses writes even when they bypass the validator', async () => {
    await expect(executor.run('DELETE FROM orders')).rejects.toMatchObject({ status: 500 });
  });

  it('refuses reads from tables the reader role was not granted', async () => {
    await expect(executor.run('SELECT * FROM pg_authid')).rejects.toMatchObject({ status: 500 });
  });
});
