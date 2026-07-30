import { apiClient, unwrap, unwrapPaginated } from './client';
import type { PaginationMeta, PaymentIntent } from '../types';

export interface ListPaymentIntentsParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  customerId?: string;
  description?: string;
}

export const paymentIntentsApi = {
  async list(
    params: ListPaymentIntentsParams = {},
  ): Promise<{ items: PaymentIntent[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/payment_intents', { params });
    return unwrapPaginated<PaymentIntent>(res);
  },

  async get(id: string): Promise<PaymentIntent> {
    const res = await apiClient.get(`/payment_intents/${id}`);
    return unwrap<PaymentIntent>(res);
  },

  async create(input: CreatePaymentIntentInput): Promise<PaymentIntent> {
    const res = await apiClient.post('/payment_intents', input);
    return unwrap<PaymentIntent>(res);
  },

  async confirm(id: string): Promise<PaymentIntent> {
    const res = await apiClient.post(`/payment_intents/${id}/confirm`);
    return unwrap<PaymentIntent>(res);
  },

  async cancel(id: string): Promise<PaymentIntent> {
    const res = await apiClient.post(`/payment_intents/${id}/cancel`);
    return unwrap<PaymentIntent>(res);
  },
};
