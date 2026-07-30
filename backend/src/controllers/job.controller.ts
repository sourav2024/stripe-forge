import { Request, Response } from 'express';
import { JobStatus } from '@prisma/client';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { UnauthorizedError } from '../utils/AppError';
import { jobLogRepository } from '../repositories/jobLog.repository';

// Observability endpoints for the async platform. JobLog rows are merchant-
// scoped: every query is filtered by req.merchant.id so one tenant never sees
// another tenant's job data.

const JOB_STATUSES: JobStatus[] = ['queued', 'active', 'completed', 'failed', 'dead'];

function parseStatus(value: unknown): JobStatus | undefined {
  return JOB_STATUSES.includes(value as JobStatus) ? (value as JobStatus) : undefined;
}

function merchantId(req: Request): string {
  if (!req.merchant) throw new UnauthorizedError('Authentication required');
  return req.merchant.id;
}

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const queue = typeof req.query.queue === 'string' ? req.query.queue : undefined;
  const status = parseStatus(req.query.status);

  const { data, total } = await jobLogRepository.list({
    merchantId: merchantId(req),
    queue,
    status,
    skip,
    take,
  });
  return paginated(res, serialize(data), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

export const jobStats = asyncHandler(async (req: Request, res: Response) => {
  const counts = await jobLogRepository.countsByStatus(merchantId(req));
  return ok(res, counts);
});
