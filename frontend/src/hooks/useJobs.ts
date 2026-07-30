import { useQuery } from '@tanstack/react-query';
import { jobsApi, type ListJobsParams } from '../api/jobs';
import { queryKeys } from './queryKeys';

export function useJobs(params: ListJobsParams) {
  return useQuery({
    queryKey: queryKeys.jobs(params),
    queryFn: () => jobsApi.list(params),
    refetchInterval: 10_000,
  });
}

export function useJobStats() {
  return useQuery({
    queryKey: queryKeys.jobStats,
    queryFn: () => jobsApi.stats(),
    refetchInterval: 10_000,
  });
}
