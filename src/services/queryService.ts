import type { QueryExecutor, QueryResult } from '../db/executor.js';
import type { SqlGenerator } from '../sql/generators.js';
import { validateReadOnlySql } from '../sql/validate.js';

export interface QueryServiceOptions {
  allowedTables: readonly string[];
  rowLimit: number;
}

export interface QuestionAnswer extends QueryResult {
  question: string;
  sql: string;
  rowCount: number;
  truncated: boolean;
}

export class QueryService {
  constructor(
    private readonly generator: SqlGenerator,
    private readonly executor: QueryExecutor,
    private readonly options: QueryServiceOptions,
  ) {}

  async ask(question: string): Promise<QuestionAnswer> {
    const generated = await this.generator.generate(question);
    const sql = validateReadOnlySql(generated, {
      allowedTables: this.options.allowedTables,
      rowLimit: this.options.rowLimit,
    });
    const result = await this.executor.run(sql);

    return {
      question,
      sql,
      columns: result.columns,
      rows: result.rows,
      rowCount: result.rows.length,
      truncated: result.rows.length >= this.options.rowLimit,
    };
  }

  get generatorName(): string {
    return this.generator.name;
  }

  get tables(): readonly string[] {
    return this.options.allowedTables;
  }
}
