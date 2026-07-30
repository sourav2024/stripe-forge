import { randomUUID } from 'node:crypto';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { makeStore } from './config/rateLimitStore';
import apiRouter from './routes';
import { errorHandler, notFound } from './middlewares/errorHandler';

export function createApp() {
  const app = express();

  // Behind a proxy/load balancer, trust the forwarded IP so req.ip and the rate
  // limiter key on the real client address.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(compression());

  // Stash the raw request body during JSON parsing. Webhook signature
  // verification (added later) must hash the exact bytes received, not a
  // re-serialised object.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req: Request, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );

  // Correlate logs and responses via a request id. Honour an inbound
  // X-Request-Id (from an upstream proxy) or mint one, and echo it back.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );

  // Liveness/readiness must be registered BEFORE the rate limiter so orchestrator
  // health probes are never throttled (a throttled probe reads as an outage).
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    // Readiness gates traffic on real dependencies. Short-circuit with a timeout
    // so a hung dependency yields 503 fast instead of blocking the probe.
    const withTimeout = <T>(p: Promise<T>, ms: number) =>
      Promise.race([
        p,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);
    try {
      await Promise.all([
        withTimeout(prisma.$queryRaw`SELECT 1`, 2000),
        withTimeout(redis.ping(), 2000),
      ]);
      res.json({ status: 'ready' });
    } catch (err) {
      res.status(503).json({ status: 'not_ready', error: (err as Error).message });
    }
  });

  const limiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore('global:'),
  });
  app.use(limiter);

  app.use('/api/v1', apiRouter);

  // 404 for unmatched routes, then the central error handler LAST.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
