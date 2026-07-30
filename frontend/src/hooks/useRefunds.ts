import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  refundsApi,
  type CreateRefundInput,
  type ListRefundsParams,
} from '../api/refunds';
import { queryKeys } from './queryKeys';

export function useRefunds(params: ListRefundsParams) {
  return useQuery({
    queryKey: queryKeys.refunds(params),
    queryFn: () => refundsApi.list(params),
  });
}

export function useCreateRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRefundInput) => refundsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
