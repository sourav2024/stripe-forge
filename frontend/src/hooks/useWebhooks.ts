import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  webhooksApi,
  type CreateWebhookEndpointInput,
  type ListDeliveriesParams,
} from '../api/webhooks';
import { queryKeys } from './queryKeys';

export function useWebhookEndpoints() {
  return useQuery({
    queryKey: queryKeys.webhookEndpoints,
    queryFn: () => webhooksApi.listEndpoints(),
  });
}

export function useWebhookDeliveries(params: ListDeliveriesParams) {
  return useQuery({
    queryKey: queryKeys.webhookDeliveries(params),
    queryFn: () => webhooksApi.listDeliveries(params),
  });
}

export function useCreateWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWebhookEndpointInput) =>
      webhooksApi.createEndpoint(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.webhookEndpoints }),
  });
}

export function useDeleteWebhookEndpoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhooksApi.deleteEndpoint(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.webhookEndpoints }),
  });
}

export function useRetryDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhooksApi.retryDelivery(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['webhooks', 'deliveries'] }),
  });
}
