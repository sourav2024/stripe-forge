import { apiClient, unwrap, unwrapPaginated } from './client';
import type { PaginationMeta, Payment } from '../types';

export interface ListPaymentsParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
}

export const paymentsApi = {
  async list(
    params: ListPaymentsParams = {},
  ): Promise<{ items: Payment[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/payments', { params });
    return unwrapPaginated<Payment>(res);
  },

  async get(id: string): Promise<Payment> {
    const res = await apiClient.get(`/payments/${id}`);
    return unwrap<Payment>(res);
  },
};
