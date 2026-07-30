import { apiClient, unwrap, unwrapPaginated } from './client';
import type { Customer, PaginationMeta } from '../types';

export interface ListCustomersParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CustomerInput {
  email: string;
  name?: string;
  phone?: string;
}

export const customersApi = {
  async list(
    params: ListCustomersParams = {},
  ): Promise<{ items: Customer[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/customers', { params });
    return unwrapPaginated<Customer>(res);
  },

  async get(id: string): Promise<Customer> {
    const res = await apiClient.get(`/customers/${id}`);
    return unwrap<Customer>(res);
  },

  async create(input: CustomerInput): Promise<Customer> {
    const res = await apiClient.post('/customers', input);
    return unwrap<Customer>(res);
  },

  async update(id: string, input: Partial<CustomerInput>): Promise<Customer> {
    const res = await apiClient.patch(`/customers/${id}`, input);
    return unwrap<Customer>(res);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`);
  },
};
