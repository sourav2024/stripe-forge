import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { UnauthorizedError } from './AppError';
import { generateToken } from './crypto';

// Access tokens are stateless JWTs carrying the merchant identity/role. Refresh
// tokens are opaque random strings (not JWTs) — only their hash is persisted, so
// they can be revoked server-side, which a self-contained JWT cannot be.

// Pin a single algorithm and issuer. Without an explicit algorithm allow-list an
// attacker can supply a token signed with a different alg (or `none`) and the
// library may accept it — a classic JWT confusion attack.
const JWT_ALG = 'HS256' as const;
const JWT_ISSUER = 'stripeforge';

export interface AccessTokenPayload {
  sub: string; // merchantId
  email: string;
  role: string;
}

// Validate the decoded claims rather than blindly casting: a token that verifies
// cryptographically can still carry an unexpected shape (missing/renamed claims)
// which would otherwise flow into auth logic as `undefined`.
const accessPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().min(1),
  role: z.string().min(1),
});

export function signAccessToken(payload: AccessTokenPayload): string {
  // TTLs are numeric seconds in env; jsonwebtoken accepts a number as seconds.
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    algorithm: JWT_ALG,
    issuer: JWT_ISSUER,
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: [JWT_ALG],
    issuer: JWT_ISSUER,
  });

  const result = accessPayloadSchema.safeParse(decoded);
  if (!result.success) {
    throw new UnauthorizedError('Malformed access token payload');
  }
  return { sub: result.data.sub, email: result.data.email, role: result.data.role };
}

/**
 * Refresh tokens are opaque so they can be revoked. We return the raw token to
 * hand to the client and its expiry so the caller can persist the hash + expiry.
 */
export function signRefreshToken(): { token: string; expiresAt: Date } {
  const token = generateToken(48);
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);
  return { token, expiresAt };
}

/**
 * There is nothing cryptographic to verify on an opaque refresh token beyond
 * shape; validity (existence, revocation, expiry) is checked against the DB by
 * the service layer. Exposed for symmetry and to centralise any future format
 * checks. Returns the token unchanged.
 */
export function verifyRefreshToken(token: string): string {
  if (!token || typeof token !== 'string') {
    throw new UnauthorizedError('Invalid refresh token');
  }
  return token;
}
