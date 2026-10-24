import { AppError } from '../errors.js';

export interface ValidationOptions {
  allowedTables: readonly string[];
  rowLimit: number;
}

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do|execute|merge|vacuum|analyze|set|reset|lock|refresh|comment|into|with|explain|pg_sleep|pg_read_file|pg_ls_dir|dblink|lo_import|lo_export)\b/i;
const LOCKING_CLAUSE = /\bfor\s+(update|share|no\s+key|key\s+share)\b/i;
const TABLE_CLAUSE_TERMINATORS = /(?=\s+(?:where|group|order|having|limit|offset|join|left|right|inner|full|cross|on)\b|$)/i;

/**
 * Defense layer one of two. The database role and a READ ONLY transaction are the
 * real guarantee; this check rejects anything unsafe before it reaches the database
 * and keeps error messages specific enough to help the user rephrase.
 */
export function validateReadOnlySql(input: string, options: ValidationOptions): string {
  const sql = input.trim().replace(/;+\s*$/, '');

  if (sql.length === 0) {
    reject('the query is empty');
  }
  if (sql.includes(';')) {
    reject('only one statement is allowed');
  }
  if (/--|\/\*/.test(sql)) {
    reject('comments are not allowed');
  }
  if (/["`\\]/.test(sql)) {
    reject('quoted identifiers are not allowed');
  }
  if (!/^select\b/i.test(sql)) {
    reject('only SELECT statements are allowed');
  }

  if (LOCKING_CLAUSE.test(sql)) {
    reject('row locking clauses are not allowed');
  }
  const forbidden = sql.match(FORBIDDEN_KEYWORDS);
  if (forbidden) {
    reject(`the keyword ${forbidden[0].toUpperCase()} is not allowed`);
  }

  const allowed = new Set(options.allowedTables);
  const tables = extractTableNames(sql);
  if (tables.length === 0) {
    reject('the query must read from one of the allowed tables');
  }
  for (const table of tables) {
    if (!allowed.has(table)) {
      reject(`table "${table}" is not allowed`);
    }
  }

  return enforceRowLimit(sql, options.rowLimit);
}

function extractTableNames(sql: string): string[] {
  const names: string[] = [];

  for (const match of sql.matchAll(new RegExp(`\\bfrom\\s+([^()]+?)${TABLE_CLAUSE_TERMINATORS.source}`, 'gi'))) {
    for (const part of match[1].split(',')) {
      const [name] = part.trim().split(/\s+/);
      if (name) {
        names.push(name.toLowerCase());
      }
    }
  }

  for (const match of sql.matchAll(/\bjoin\s+([a-z_][\w.]*)/gi)) {
    names.push(match[1].toLowerCase());
  }

  return names;
}

function enforceRowLimit(sql: string, rowLimit: number): string {
  if (!/\blimit\b/i.test(sql)) {
    return `${sql} LIMIT ${rowLimit}`;
  }

  const limit = sql.match(/\blimit\s+(\d+)/i);
  if (!limit) {
    reject('LIMIT must be followed by a number');
  }
  return sql.replace(/\blimit\s+\d+/i, `LIMIT ${Math.min(Number(limit[1]), rowLimit)}`);
}

function reject(reason: string): never {
  throw new AppError(422, `Generated SQL was rejected: ${reason}`);
}
