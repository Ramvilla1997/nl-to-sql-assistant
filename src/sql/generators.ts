import { AppError } from '../errors.js';
import { SCHEMA_DESCRIPTION } from './schemaDescription.js';

export interface SqlGenerator {
  readonly name: string;
  generate(question: string): Promise<string>;
}

interface Rule {
  pattern: RegExp;
  sql: string;
}

const RULES: readonly Rule[] = [
  {
    pattern: /revenue by month|monthly revenue/,
    sql: "SELECT date_trunc('month', o.ordered_at) AS month, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue FROM orders o JOIN order_items oi ON oi.order_id = o.id GROUP BY 1 ORDER BY 1",
  },
  {
    pattern: /total revenue|revenue total|how much revenue/,
    sql: 'SELECT ROUND(SUM(quantity * unit_price), 2) AS revenue FROM order_items',
  },
  {
    pattern: /how many orders|number of orders|count .*orders/,
    sql: 'SELECT COUNT(*) AS order_count FROM orders',
  },
  {
    pattern: /top products|best.?sell/,
    sql: 'SELECT p.name, SUM(oi.quantity) AS units_sold FROM order_items oi JOIN products p ON p.id = oi.product_id GROUP BY p.name ORDER BY units_sold DESC',
  },
  {
    pattern: /orders per customer|which customers? order|most orders/,
    sql: 'SELECT c.name, COUNT(o.id) AS order_count FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.name ORDER BY order_count DESC',
  },
];

export const SUPPORTED_QUESTIONS_HINT =
  'Try asking about total revenue, revenue by month, how many orders there are, top products, or orders per customer.';

/**
 * Offline translator. It maps known question shapes to fixed SQL, so the demo and
 * CI run without a model. It never builds SQL from user text.
 */
export class RuleBasedSqlGenerator implements SqlGenerator {
  readonly name = 'rules';

  async generate(question: string): Promise<string> {
    const normalized = question.toLowerCase();
    const rule = RULES.find((candidate) => candidate.pattern.test(normalized));
    if (!rule) {
      throw new AppError(422, `I cannot translate that question yet. ${SUPPORTED_QUESTIONS_HINT}`);
    }
    return rule.sql;
  }
}

export class OllamaSqlGenerator implements SqlGenerator {
  readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async generate(question: string): Promise<string> {
    const prompt = [
      'You translate questions into PostgreSQL.',
      'Return exactly one SELECT statement and nothing else. No comments, no markdown.',
      'Use only these tables and columns:',
      SCHEMA_DESCRIPTION,
      '',
      `Question: ${question}`,
      'SQL:',
    ].join('\n');

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt, stream: false }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      throw new AppError(502, 'The language model is unavailable', { cause: error });
    }

    if (!response.ok) {
      throw new AppError(502, 'The language model returned an error');
    }

    const body = (await response.json()) as { response?: unknown };
    if (typeof body.response !== 'string') {
      throw new AppError(502, 'The language model returned an unexpected response');
    }
    return stripCodeFence(body.response);
  }
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^\s*```(?:sql)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}
