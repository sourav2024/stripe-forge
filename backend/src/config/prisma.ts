import { PrismaClient } from '@prisma/client';
import { env } from './env';

// A single PrismaClient instance is reused across the process. Instantiating
// one per request would exhaust the Postgres connection pool under load.
export const prisma = new PrismaClient({
  log: env.isProd ? ['warn', 'error'] : ['warn', 'error'],
});
