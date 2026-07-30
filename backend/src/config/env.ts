import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Environment is validated once at boot. Failing fast here means a
// misconfigured deployment crashes immediately instead of erroring deep
// inside a request handler with a cryptic stack trace.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  LOG_LEVEL: z.string().default('info'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(604800),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),

  // Auth endpoints (login/signup/password) get a stricter limiter to blunt
  // credential-stuffing/brute-force. Defaults: 10 attempts per 15 minutes.
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),

  WEBHOOK_MAX_ATTEMPTS: z.coerce.number().default(5),
})
  // In production, refuse to boot with placeholder JWT secrets. A shipped
  // "change_me" secret is trivially guessable and forges valid access tokens.
  .refine(
    (e) =>
      e.NODE_ENV !== 'production' ||
      (!e.JWT_ACCESS_SECRET.includes('change_me') &&
        !e.JWT_REFRESH_SECRET.includes('change_me')),
    { message: 'JWT secrets must not use placeholder values in production' },
  );

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  isProd: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};

export type Env = typeof env;
