import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';

const base = { DATABASE_URL: 'postgres://nl_sql_reader:secret@localhost:5432/postgres' };

describe('loadEnv', () => {
  it('requires a Postgres connection string', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres URL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'https://example.com' })).toThrow(/DATABASE_URL/);
  });

  it('applies safe defaults', () => {
    const env = loadEnv(base);
    expect(env.LLM_PROVIDER).toBe('rules');
    expect(env.ROW_LIMIT).toBe(100);
    expect(env.ALLOWED_TABLES).toEqual(['customers', 'products', 'orders', 'order_items']);
  });

  it('rejects an unsafe row limit', () => {
    expect(() => loadEnv({ ...base, ROW_LIMIT: '100000' })).toThrow(/ROW_LIMIT/);
  });

  it('rejects table names that are not plain identifiers', () => {
    expect(() => loadEnv({ ...base, ALLOWED_TABLES: 'orders;drop' })).toThrow(/ALLOWED_TABLES/);
  });
});
