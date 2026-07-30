import { apiClient, unwrap, unwrapPaginated } from './client';
import type { LedgerBalance, LedgerEntry, PaginationMeta } from '../types';

export interface ListLedgerParams {
  page?: number;
  pageSize?: number;
  account?: string;
}

export const ledgerApi = {
  async history(
    params: ListLedgerParams = {},
  ): Promise<{ items: LedgerEntry[]; meta: PaginationMeta }> {
    const res = await apiClient.get('/ledger', { params });
    return unwrapPaginated<LedgerEntry>(res);
  },

  async balance(): Promise<LedgerBalance> {
    const res = await apiClient.get('/ledger/balance');
    return unwrap<LedgerBalance>(res);
  },
};
