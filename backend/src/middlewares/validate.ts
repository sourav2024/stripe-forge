import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../utils/AppError';

type Source = 'body' | 'query' | 'params';

/**
 * Middleware factory that validates `req[source]` against a Zod schema. On
 * success the parsed (coerced/defaulted) value is written back so downstream
 * handlers consume trusted, typed data. On failure a 422 ValidationError with
 * flattened issues is thrown for the central handler.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new ValidationError('Validation failed', result.error.flatten());
    }
    // `query`/`params` are read-only getters on some Express versions; assign via
    // defineProperty-safe reassignment only for `body`, mutate in place otherwise.
    if (source === 'body') {
      req.body = result.data;
    } else {
      Object.assign(req[source], result.data);
    }
    next();
  };
}
