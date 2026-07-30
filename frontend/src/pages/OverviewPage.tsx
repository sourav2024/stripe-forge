import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DollarSign,
  CheckCircle2,
  RotateCcw,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { useDashboard } from '../hooks/useDashboard';
import { formatMoney, formatDate, shortId } from '../utils/format';

export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useDashboard();
  const currency = data?.currency ?? 'usd';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="A snapshot of your account activity and balance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Payments volume"
          value={formatMoney(data?.totalVolume ?? 0, currency)}
          icon={DollarSign}
          tone="primary"
          loading={isLoading}
        />
        <StatCard
          label="Succeeded"
          value={String(data?.succeededCount ?? 0)}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
        />
        <StatCard
          label="Refunds total"
          value={formatMoney(data?.refundsTotal ?? 0, currency)}
          icon={RotateCcw}
          tone="danger"
          loading={isLoading}
        />
        <StatCard
          label="Customers"
          value={String(data?.customersCount ?? 0)}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          label="Balance"
          value={formatMoney(data?.balance ?? 0, currency)}
          icon={Wallet}
          tone="primary"
          loading={isLoading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment volume (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <ErrorState message="Could not load analytics." onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="h-64 w-full animate-pulse rounded-md bg-muted" />
          ) : (
            <VolumeChart data={data?.volumeSeries ?? []} currency={currency} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentPayments
          items={data?.recentPayments ?? []}
          loading={isLoading}
          currency={currency}
        />
        <RecentRefunds
          items={data?.recentRefunds ?? []}
          loading={isLoading}
          currency={currency}
        />
      </div>
    </div>
  );
}

function VolumeChart({
  data,
  currency,
}: {
  data: { date: string; volume: number }[];
  currency: string;
}) {
  const hasData = data.some((d) => d.volume > 0);
  if (!hasData) {
    return (
      <EmptyState
        title="No volume yet"
        description="Succeeded payments will appear here over time."
      />
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => v.slice(5)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => `${Math.round(v / 100)}`}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
            formatter={(value: number) => [formatMoney(value, currency), 'Volume']}
          />
          <Area
            type="monotone"
            dataKey="volume"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#vol)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecentPayments({
  items,
  loading,
  currency,
}: {
  items: { id: string; amount: number; status: string; currency: string; createdAt: string }[];
  loading: boolean;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent payments</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ActivitySkeleton />
        ) : items.length === 0 ? (
          <EmptyState title="No payments yet" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{shortId(p.id)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(p.amount, p.currency || currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentRefunds({
  items,
  loading,
  currency,
}: {
  items: { id: string; amount: number; status: string; currency: string; createdAt: string }[];
  loading: boolean;
  currency: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent refunds</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ActivitySkeleton />
        ) : items.length === 0 ? (
          <EmptyState title="No refunds yet" />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{shortId(r.id)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={r.status} />
                  <span className="text-sm font-medium tabular-nums text-destructive">
                    -{formatMoney(r.amount, r.currency || currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="flex items-center justify-between py-3">
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </li>
      ))}
    </ul>
  );
}
