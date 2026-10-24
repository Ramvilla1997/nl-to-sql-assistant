import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LLM_PROVIDER: z.enum(['rules', 'ollama']).default('rules'),
  OLLAMA_BASE_URL: z.url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5-coder:7b'),
  ALLOWED_TABLES: z
    .string()
    .default('customers,products,orders,order_items')
    .transform((value) => value.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[a-z_][a-z0-9_]*$/)).min(1)),
  ROW_LIMIT: z.coerce.number().int().min(1).max(1000).default(100),
  STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(3000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}
