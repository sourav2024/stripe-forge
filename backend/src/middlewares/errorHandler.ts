import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/AppError';
import { env } from '../config/env';
import { logger } from '../config/logger';

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

function send(res: Response, status: number, code: string, message: string, details?: unknown): void {
  const body: ErrorBody = { success: false, error: { code, message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

/**
 * Central error handler. Must be registered LAST. Maps our typed error
 * hierarchy, Zod validation failures, and known Prisma errors to the shared
 * error envelope; anything else is treated as an unexpected bug — logged loudly
 * and surfaced generically so internals never leak in production.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    send(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  if (err instanceof ZodError) {
    send(res, 422, 'validation_error', 'Validation failed', err.flatten());
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        // Unique constraint violation.
        const target = (err.meta as { target?: string[] } | undefined)?.target;
        send(res, 409, 'conflict', 'A record with these values already exists', { target });
        return;
      }
      case 'P2025': {
        // Record required by the operation was not found.
        send(res, 404, 'not_found', 'The requested resource was not found');
        return;
      }
      default: {
        send(res, 400, 'bad_request', 'Database request error', { prismaCode: err.code });
        return;
      }
    }
  }

  // Unexpected / non-operational error: log the full detail server-side only.
  logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  send(
    res,
    500,
    'internal_error',
    env.isProd ? 'Something went wrong' : err instanceof Error ? err.message : String(err),
  );
}

/** Terminal middleware for unmatched routes; hands a 404 to the error handler. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}
