import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors.js';
import { isProd } from '../config/env.js';

/**
 * The ONLY place an error becomes an HTTP response. Route handlers and
 * services throw AppError subclasses (or let ZodError/Prisma errors bubble
 * up); this is where that gets translated, once, consistently.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request.', details: err.flatten() },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (isProd) {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      status: 500,
      code: 'UNHANDLED_ERROR',
      message: err instanceof Error ? err.message : String(err),
      path: req.path,
      method: req.method,
    }));
  } else {
    console.error('Unhandled error:', err);
  }
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Something went wrong.' : err instanceof Error ? err.message : String(err),
    },
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route: ${req.method} ${req.path}` } });
}
