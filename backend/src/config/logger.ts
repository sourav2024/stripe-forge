import pino from 'pino';
import { env } from './env';

// A single structured logger is shared process-wide. In development we pretty
// print for humans; in production we emit newline-delimited JSON so log
// aggregators (Loki, CloudWatch, Datadog) can parse fields directly.
export const logger = pino({
  level: env.LOG_LEVEL,
  // Never persist secrets to logs. Auth headers, cookies and any secret-bearing
  // field are censored before serialisation — leaked logs are a common breach
  // vector and these values grant account/API access.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.signingSecret',
      '*.apiKeySecret',
    ],
    censor: '[REDACTED]',
  },
  transport: env.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
      },
});

export type Logger = typeof logger;
