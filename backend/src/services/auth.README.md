# Auth Module

## Purpose
Handles merchant identity for StripeForge: registration, login, session lifecycle (short-lived access tokens + rotating refresh tokens), password reset, and email verification. It is the gate every protected route sits behind.

## Responsibilities
- Register merchants (hash password, mint API key pair + email-verification token).
- Authenticate credentials and issue an access/refresh token pair.
- Rotate refresh tokens (revoke-on-use) and support explicit logout.
- Drive password reset (request → reset) without leaking account existence.
- Verify merchant emails.
- Record security-relevant events to the immutable audit log.

## Flow
1. **Signup** → hash password (bcrypt, 10 rounds), generate `pk_test_*`/`sk_test_*` keys + verify token, persist merchant, issue tokens. `apiKeySecret` is returned **once**.
2. **Login** → look up by email, `bcrypt.compare`, issue tokens. Uniform error on any failure to prevent account enumeration.
3. **Refresh** → hash presented token, find a valid (unrevoked, unexpired) row, revoke it, issue a new pair (rotation).
4. **Logout** → revoke the presented refresh token (idempotent).
5. **Password reset request** → set token + 1h expiry; always returns success; token returned in-body since there is no mailer.
6. **Password reset** → validate token + expiry, set new hash, clear token, revoke ALL refresh tokens.
7. **Verify email** → consume `emailVerifyToken`, set `emailVerified = true`.

## Public APIs (mounted at `/api/v1/auth`)
| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/signup` | – | `{ email, password, name }` |
| POST | `/login` | – | `{ email, password }` |
| POST | `/refresh` | – | `{ refreshToken }` |
| POST | `/logout` | – | `{ refreshToken }` |
| POST | `/password/reset-request` | – | `{ email }` |
| POST | `/password/reset` | – | `{ token, newPassword }` |
| POST | `/verify-email` | – | `{ token }` |
| GET | `/me` | Bearer | – |

Programmatic surface: `authService.{signup,login,refresh,logout,requestPasswordReset,resetPassword,verifyEmail}`, and middleware `requireAuth` / `requireRole(...roles)`.

## Business Rules
- Passwords: min 8 chars; stored only as bcrypt hashes.
- Access tokens are stateless JWTs (`{ sub, email, role }`, TTL `JWT_ACCESS_TTL`); refresh tokens are opaque random strings, only their SHA-256 hash is stored so they can be revoked.
- Refresh tokens rotate on every use; a password reset revokes every active token.
- Login/reset-request never disclose whether an email exists.
- `passwordHash` and `apiKeySecret` are never returned; `apiKeySecret` is shown exactly once at signup.

## Dependencies
- `../config/prisma`, `../config/env`, `../config/logger`
- `../utils/{jwt,password,crypto,audit,AppError,http,serialize}`
- Prisma models: `Merchant`, `RefreshToken`, `AuditLog`.

## Example Request
```http
POST /api/v1/auth/signup
Content-Type: application/json

{ "email": "acme@example.com", "password": "hunter2hunter2", "name": "Acme Inc" }
```

## Example Response
```json
{
  "success": true,
  "data": {
    "merchant": {
      "id": "…", "email": "acme@example.com", "name": "Acme Inc",
      "role": "OWNER", "emailVerified": false, "apiKeyPublic": "pk_test_…"
    },
    "tokens": { "accessToken": "eyJ…", "refreshToken": "a1b2…" },
    "apiKeySecret": "sk_test_…",
    "emailVerifyToken": "…"
  }
}
```

## Future Improvements
- Deliver verify/reset tokens by email instead of returning them in the body.
- Detect refresh-token reuse (a revoked token being presented) and revoke the whole family.
- Add 2FA/TOTP, login rate-limiting/lockout, and password breach checks.
- Separate API-key auth middleware for server-to-server calls using `pk_/sk_` keys.

## How Stripe Solves This
Stripe issues restricted/secret API keys shown only once at creation (mirrored here by `apiKeySecret`), backs the dashboard with short-lived sessions, offers key rolling/rotation, and enforces 2FA on dashboard accounts. Our rotating refresh tokens and one-time secret reveal are a simplified take on those patterns.
