import { useQuery } from '@tanstack/react-query';
import { ledgerApi, type ListLedgerParams } from '../api/ledger';
import { queryKeys } from './queryKeys';

export function useLedger(params: ListLedgerParams) {
  return useQuery({
    queryKey: queryKeys.ledger(params),
    queryFn: () => ledgerApi.history(params),
  });
}

export function useLedgerBalance() {
  return useQuery({
    queryKey: queryKeys.ledgerBalance,
    queryFn: () => ledgerApi.balance(),
  });
}
