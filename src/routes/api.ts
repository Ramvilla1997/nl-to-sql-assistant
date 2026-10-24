import { Router } from 'express';
import type { QueryService } from '../services/queryService.js';
import { AppError } from '../errors.js';
import { questionInputSchema } from './schemas.js';

export function createApiRouter(service: QueryService): Router {
  const router = Router();

  router.get('/health', (_request, response) => {
    response.json({ status: 'ok', generator: service.generatorName });
  });

  router.get('/tables', (_request, response) => {
    response.json({ tables: service.tables });
  });

  router.post('/query', async (request, response) => {
    const parsed = questionInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'Invalid question: provide a question of 3 to 500 characters');
    }
    const answer = await service.ask(parsed.data.question);
    response.json(answer);
  });

  return router;
}
