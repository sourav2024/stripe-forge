import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  customersApi,
  type CustomerInput,
  type ListCustomersParams,
} from '../api/customers';
import { queryKeys } from './queryKeys';

export function useCustomers(params: ListCustomersParams) {
  return useQuery({
    queryKey: queryKeys.customers(params),
    queryFn: () => customersApi.list(params),
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => customersApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomerInput> }) =>
      customersApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
