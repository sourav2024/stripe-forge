import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  paymentIntentsApi,
  type CreatePaymentIntentInput,
  type ListPaymentIntentsParams,
} from '../api/paymentIntents';
import { queryKeys } from './queryKeys';

export function usePaymentIntents(params: ListPaymentIntentsParams) {
  return useQuery({
    queryKey: queryKeys.paymentIntents(params),
    queryFn: () => paymentIntentsApi.list(params),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['paymentIntents'] });
  qc.invalidateQueries({ queryKey: ['payments'] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  qc.invalidateQueries({ queryKey: ['ledger'] });
}

export function useCreatePaymentIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentIntentInput) => paymentIntentsApi.create(input),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useConfirmPaymentIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentIntentsApi.confirm(id),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useCancelPaymentIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => paymentIntentsApi.cancel(id),
    onSuccess: () => invalidateAll(qc),
  });
}
