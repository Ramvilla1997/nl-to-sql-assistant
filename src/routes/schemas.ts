import { z } from 'zod';

export const questionInputSchema = z.object({
  question: z.string().trim().min(3).max(500),
});
