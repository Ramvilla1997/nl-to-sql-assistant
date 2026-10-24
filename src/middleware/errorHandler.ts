import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof AppError) {
    response.status(error.status).json({ error: error.publicMessage });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: 'Request body must be valid JSON' });
    return;
  }

  console.error('Unhandled error', error);
  response.status(500).json({ error: 'Internal server error' });
}
