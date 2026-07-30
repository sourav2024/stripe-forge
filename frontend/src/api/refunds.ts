import { apiClient, unwrap, unwrapPaginated } from './client';
import type { PaginationMeta, Refund } from '../types';

export interface ListRefundsParams {
  page?: number;
  pageSize?: number;
}

export interface CreateRefundInput {
  paymentId: string;
  amount?: number;
  reason?: string;
}

export const refundsApi = {
  async list(
    params: ListRefundsParams = {},
  ): Promise<{ items: Refund[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/refunds', { params });
    return unwrapPaginated<Refund>(res);
  },

  async get(id: string): Promise<Refund> {
    const res = await apiClient.get(`/refunds/${id}`);
    return unwrap<Refund>(res);
  },

  async create(input: CreateRefundInput): Promise<Refund> {
    const res = await apiClient.post('/refunds', input);
    return unwrap<Refund>(res);
  },
};
