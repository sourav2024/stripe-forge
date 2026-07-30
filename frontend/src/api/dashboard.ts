import { apiClient, unwrap } from './client';
import type { DashboardAnalytics, Payment } from '../types';
import { paymentsApi } from './payments';
import { refundsApi } from './refunds';
import { customersApi } from './customers';
import { ledgerApi } from './ledger';

/**
 * Fetch dashboard analytics from the dedicated endpoint. If the backend does not
 * expose `/dashboard` (404), gracefully degrade by composing an equivalent view
 * from the individual list endpoints.
 */
export const dashboardApi = {
  async get(): Promise<DashboardAnalytics> {
    try {
      const res = await apiClient.get('/dashboard');
      return unwrap<DashboardAnalytics>(res);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status && status !== 404) throw err;
      return composeAnalytics();
    }
  },
};

async function composeAnalytics(): Promise<DashboardAnalytics> {
  const [payments, refunds, customers, balance] = await Promise.all([
    paymentsApi.list({ page: 1, pageSize: 100 }),
    refundsApi.list({ page: 1, pageSize: 100 }),
    customersApi.list({ page: 1, pageSize: 1 }),
    ledgerApi.balance().catch(() => null),
  ]);

  const succeeded = payments.items.filter((p) => p.status === 'succeeded');
  const totalVolume = succeeded.reduce((sum, p) => sum + p.amount, 0);
  const refundsTotal = refunds.items
    .filter((r) => r.status === 'succeeded')
    .reduce((sum, r) => sum + r.amount, 0);

  const currency = payments.items[0]?.currency ?? balance?.currency ?? 'usd';

  return {
    currency,
    totalVolume,
    succeededCount: succeeded.length,
    refundsTotal,
    customersCount: customers.meta.total,
    balance: balance?.available ?? totalVolume - refundsTotal,
    volumeSeries: buildVolumeSeries(succeeded),
    recentPayments: payments.items.slice(0, 6),
    recentRefunds: refunds.items.slice(0, 6),
  };
}

// Bucket succeeded payments into the last 14 days for a small trend chart.
function buildVolumeSeries(payments: Payment[]): DashboardAnalytics['volumeSeries'] {
  const days = 14;
  const buckets = new Map<string, { volume: number; count: number }>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), { volume: 0, count: 0 });
  }

  for (const p of payments) {
    const key = new Date(p.createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.volume += p.amount;
      bucket.count += 1;
    }
  }

  return Array.from(buckets.entries()).map(([date, v]) => ({
    date,
    volume: v.volume,
    count: v.count,
  }));
}
