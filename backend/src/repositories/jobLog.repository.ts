import { Prisma, JobStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

// Persisted mirror of BullMQ job state for dashboard visibility. Rows are keyed
// by the (queue, jobId) unique constraint and upserted on each state
// transition. Rows are merchant-scoped (nullable for platform jobs) so the jobs
// endpoint never leaks one tenant's job data to another.

export interface UpsertJobLogInput {
  queue: string;
  jobId: string;
  name: string;
  status: JobStatus;
  attempts: number;
  merchantId?: string | null;
  data?: Prisma.InputJsonValue;
  error?: string | null;
}

export interface JobLogListParams {
  merchantId: string;
  queue?: string;
  status?: JobStatus;
  skip: number;
  take: number;
}

export const jobLogRepository = {
  upsertJobLog(input: UpsertJobLogInput) {
    const { queue, jobId, name, status, attempts, merchantId, data, error } = input;
    // Real upsert on the (queue, jobId) unique constraint — atomic, so
    // concurrent status events for one job cannot race into duplicate rows.
    return prisma.jobLog.upsert({
      where: { queue_jobId: { queue, jobId } },
      update: {
        name,
        status,
        attempts,
        ...(merchantId !== undefined ? { merchantId } : {}),
        ...(data !== undefined ? { data } : {}),
        ...(error !== undefined ? { error } : {}),
      },
      create: {
        queue,
        jobId,
        name,
        status,
        attempts,
        ...(merchantId !== undefined ? { merchantId } : {}),
        ...(data !== undefined ? { data } : {}),
        ...(error !== undefined ? { error } : {}),
      },
    });
  },

  async list({ merchantId, queue, status, skip, take }: JobLogListParams) {
    // merchantId is REQUIRED and authoritative: never return other tenants' rows.
    const where: Prisma.JobLogWhereInput = {
      merchantId,
      ...(queue ? { queue } : {}),
      ...(status ? { status } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.jobLog.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
      prisma.jobLog.count({ where }),
    ]);
    return { data, total };
  },

  /** Aggregate counts grouped by status for the dashboard, scoped to a merchant. */
  async countsByStatus(merchantId: string) {
    const grouped = await prisma.jobLog.groupBy({
      by: ['status'],
      where: { merchantId },
      _count: { _all: true },
    });
    const counts: Record<string, number> = {};
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return counts;
  },
};
