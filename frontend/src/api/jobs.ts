import { apiClient, unwrap, unwrapPaginated } from './client';
import type { JobLog, JobStats, PaginationMeta } from '../types';

export interface ListJobsParams {
  page?: number;
  pageSize?: number;
  queue?: string;
  status?: string;
}

export const jobsApi = {
  async list(
    params: ListJobsParams = {},
  ): Promise<{ items: JobLog[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/jobs', { params });
    return unwrapPaginated<JobLog>(res);
  },

  async stats(): Promise<JobStats> {
    const res = await apiClient.get('/jobs/stats');
    return unwrap<JobStats>(res);
  },
};
