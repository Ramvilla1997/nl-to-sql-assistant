import { describe, expect, it } from 'vitest';
import { validateReadOnlySql } from '../src/sql/validate.js';

const options = { allowedTables: ['customers', 'orders', 'order_items', 'products'], rowLimit: 100 };

function rejectionOf(sql: string): string {
  try {
    validateReadOnlySql(sql, options);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error(`expected "${sql}" to be rejected`);
}

describe('validateReadOnlySql: accepts', () => {
  it('a simple select and appends the row limit', () => {
    expect(validateReadOnlySql('SELECT name FROM customers', options)).toBe(
      'SELECT name FROM customers LIMIT 100',
    );
  });

  it('joins between allowed tables', () => {
    const sql = 'SELECT c.name FROM customers c JOIN orders o ON o.customer_id = c.id';
    expect(validateReadOnlySql(sql, options)).toBe(`${sql} LIMIT 100`);
  });

  it('a trailing semicolon is tolerated', () => {
    expect(validateReadOnlySql('SELECT id FROM orders;', options)).toBe('SELECT id FROM orders LIMIT 100');
  });

  it('caps a larger requested limit to the configured row limit', () => {
    expect(validateReadOnlySql('SELECT id FROM orders LIMIT 5000', options)).toBe('SELECT id FROM orders LIMIT 100');
  });

  it('keeps a smaller requested limit', () => {
    expect(validateReadOnlySql('SELECT id FROM orders LIMIT 5', options)).toBe('SELECT id FROM orders LIMIT 5');
  });
});

describe('validateReadOnlySql: rejects', () => {
  it.each([
    ['DELETE FROM orders', 'only SELECT statements are allowed'],
    ['UPDATE orders SET id = 1', 'only SELECT statements are allowed'],
    ['DROP TABLE orders', 'only SELECT statements are allowed'],
    ['SELECT id FROM orders; DROP TABLE orders', 'only one statement is allowed'],
    ['SELECT id FROM orders -- ignore the rest', 'comments are not allowed'],
    ['SELECT id FROM orders /* hidden */', 'comments are not allowed'],
    ['SELECT id FROM orders FOR UPDATE', 'row locking clauses are not allowed'],
    ['SELECT id INTO backup FROM orders', 'the keyword INTO is not allowed'],
    ['WITH x AS (SELECT id FROM orders) SELECT id FROM x', 'only SELECT statements are allowed'],
    ['SELECT id FROM orders WHERE id IN (SELECT id INTO x FROM orders)', 'the keyword INTO is not allowed'],
    ['SELECT pg_sleep(10) FROM orders', 'the keyword PG_SLEEP is not allowed'],
    ['SELECT id FROM "orders"', 'quoted identifiers are not allowed'],
    ['SELECT id FROM public.orders', 'table "public.orders" is not allowed'],
    ['SELECT * FROM users', 'table "users" is not allowed'],
    ['SELECT o.id FROM orders o, users u', 'table "users" is not allowed'],
    ['SELECT o.id FROM orders o JOIN secrets s ON s.id = o.id', 'table "secrets" is not allowed'],
    ['SELECT * FROM generate_series(1, 5)', 'the query must read from one of the allowed tables'],
    ['SELECT 1', 'the query must read from one of the allowed tables'],
    ['SELECT id FROM orders LIMIT ALL', 'LIMIT must be followed by a number'],
    ['   ', 'the query is empty'],
  ])('%s', (sql, reason) => {
    expect(rejectionOf(sql)).toContain(reason);
  });

  it('wraps rejections as 422 errors with a safe message', () => {
    expect(() => validateReadOnlySql('DELETE FROM orders', options)).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });
});
