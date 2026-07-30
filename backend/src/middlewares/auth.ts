import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Verify the `Authorization: Bearer <token>` access token and attach the
 * merchant identity to the request. Any missing/malformed/invalid token yields a
 * 401 — we never distinguish the failure mode to avoid leaking token internals.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.merchant = { id: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired access token');
  }
}

/** Guard a route to a set of merchant roles. Must run after `requireAuth`. */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.merchant) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.merchant.role)) {
      throw new ForbiddenError('Insufficient role for this action');
    }
    next();
  };
}
