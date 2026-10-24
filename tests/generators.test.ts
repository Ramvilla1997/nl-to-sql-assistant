import { describe, expect, it } from 'vitest';
import { OllamaSqlGenerator, RuleBasedSqlGenerator } from '../src/sql/generators.js';

describe('RuleBasedSqlGenerator', () => {
  const generator = new RuleBasedSqlGenerator();

  it('maps a known question shape to fixed SQL', async () => {
    await expect(generator.generate('How many orders do we have?')).resolves.toBe(
      'SELECT COUNT(*) AS order_count FROM orders',
    );
  });

  it('prefers the more specific monthly revenue rule', async () => {
    await expect(generator.generate('Show revenue by month')).resolves.toContain("date_trunc('month'");
  });

  it('rejects questions it cannot translate, without building SQL from the text', async () => {
    await expect(generator.generate("Drop the orders table; it's old")).rejects.toMatchObject({
      status: 422,
    });
  });
});

describe('OllamaSqlGenerator', () => {
  it('strips markdown code fences from the model answer', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ response: '```sql\nSELECT id FROM orders\n```' }), {
        status: 200,
      })) as unknown as typeof fetch;
    const generator = new OllamaSqlGenerator('http://ollama.invalid', 'model', fetchImpl);
    await expect(generator.generate('orders?')).resolves.toBe('SELECT id FROM orders');
  });

  it('maps an unreachable model server to a 502 without exposing the cause', async () => {
    const failingFetch = (() => Promise.reject(new Error('ECONNREFUSED'))) as unknown as typeof fetch;
    const generator = new OllamaSqlGenerator('http://ollama.invalid', 'model', failingFetch);
    await expect(generator.generate('orders?')).rejects.toMatchObject({
      status: 502,
      publicMessage: 'The language model is unavailable',
    });
  });
});
