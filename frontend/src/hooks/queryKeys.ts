import type { ListCustomersParams } from '../api/customers';
import type { ListPaymentIntentsParams } from '../api/paymentIntents';
import type { ListPaymentsParams } from '../api/payments';
import type { ListRefundsParams } from '../api/refunds';
import type { ListLedgerParams } from '../api/ledger';
import type { ListDeliveriesParams } from '../api/webhooks';
import type { ListJobsParams } from '../api/jobs';

// Centralized, structured query keys so mutations can invalidate precisely.
export const queryKeys = {
  dashboard: ['dashboard'] as const,

  customers: (params: ListCustomersParams) => ['customers', 'list', params] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,

  paymentIntents: (params: ListPaymentIntentsParams) =>
    ['paymentIntents', 'list', params] as const,
  paymentIntent: (id: string) => ['paymentIntents', 'detail', id] as const,

  payments: (params: ListPaymentsParams) => ['payments', 'list', params] as const,
  payment: (id: string) => ['payments', 'detail', id] as const,

  refunds: (params: ListRefundsParams) => ['refunds', 'list', params] as const,

  ledger: (params: ListLedgerParams) => ['ledger', 'history', params] as const,
  ledgerBalance: ['ledger', 'balance'] as const,

  webhookEndpoints: ['webhooks', 'endpoints'] as const,
  webhookDeliveries: (params: ListDeliveriesParams) =>
    ['webhooks', 'deliveries', params] as const,

  jobs: (params: ListJobsParams) => ['jobs', 'list', params] as const,
  jobStats: ['jobs', 'stats'] as const,
};
