import { apiClient, unwrap, unwrapPaginated } from './client';
import type {
  PaginationMeta,
  WebhookDelivery,
  WebhookEndpoint,
} from '../types';

export interface CreateWebhookEndpointInput {
  url: string;
  enabledEvents: string[];
}

export interface ListDeliveriesParams {
  page?: number;
  pageSize?: number;
  status?: string;
  endpointId?: string;
}

export const webhooksApi = {
  async listEndpoints(): Promise<WebhookEndpoint[]> {
    const res = await apiClient.get('/webhook_endpoints');
    return unwrapPaginated<WebhookEndpoint>(res).items;
  },

  async createEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    const res = await apiClient.post('/webhook_endpoints', input);
    return unwrap<WebhookEndpoint>(res);
  },

  async updateEndpoint(
    id: string,
    input: Partial<CreateWebhookEndpointInput> & { enabled?: boolean },
  ): Promise<WebhookEndpoint> {
    const res = await apiClient.patch(`/webhook_endpoints/${id}`, input);
    return unwrap<WebhookEndpoint>(res);
  },

  async deleteEndpoint(id: string): Promise<void> {
    await apiClient.delete(`/webhook_endpoints/${id}`);
  },

  async listDeliveries(
    params: ListDeliveriesParams = {},
  ): Promise<{ items: WebhookDelivery[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/webhook_deliveries', { params });
    return unwrapPaginated<WebhookDelivery>(res);
  },

  async retryDelivery(id: string): Promise<WebhookDelivery> {
    const res = await apiClient.post(`/webhook_deliveries/${id}/retry`);
    return unwrap<WebhookDelivery>(res);
  },
};
