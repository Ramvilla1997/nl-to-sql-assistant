import type { Pool } from 'pg';
import { AppError } from '../errors.js';

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface QueryExecutor {
  run(sql: string): Promise<QueryResult>;
}

/**
 * Defense layer two of two. Even if validation were bypassed, the statement runs
 * inside a READ ONLY transaction with a timeout, under a role that can only SELECT.
 */
export function createReadOnlyExecutor(pool: Pool, statementTimeoutMs: number): QueryExecutor {
  return {
    async run(sql: string): Promise<QueryResult> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN READ ONLY');
        await client.query(`SET LOCAL statement_timeout = ${Math.trunc(statementTimeoutMs)}`);
        const result = await client.query(sql);
        await client.query('COMMIT');
        return {
          columns: result.fields.map((field) => field.name),
          rows: result.rows,
        };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new AppError(500, 'The query could not be completed', { cause: error });
      } finally {
        client.release();
      }
    },
  };
}
