import { useQuery } from '@tanstack/react-query';
import { paymentsApi, type ListPaymentsParams } from '../api/payments';
import { queryKeys } from './queryKeys';

export function usePayments(params: ListPaymentsParams) {
  return useQuery({
    queryKey: queryKeys.payments(params),
    queryFn: () => paymentsApi.list(params),
  });
}

export function usePayment(id: string | null) {
  return useQuery({
    queryKey: queryKeys.payment(id ?? ''),
    queryFn: () => paymentsApi.get(id as string),
    enabled: !!id,
  });
}
