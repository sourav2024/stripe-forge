import { useState } from 'react';
import { Wallet, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge';
import { useLedger, useLedgerBalance } from '../hooks/useLedger';
import { formatMoney, formatDateTime, shortId } from '../utils/format';

const PAGE_SIZE = 15;
const COLUMNS = ['Account', 'Direction', 'Amount', 'Transaction', 'Description', 'Created'];

export function LedgerPage() {
  const [page, setPage] = useState(1);
  const balance = useLedgerBalance();
  const { data, isLoading, isError, refetch } = useLedger({ page, pageSize: PAGE_SIZE });

  const currency = balance.data?.currency ?? data?.items[0]?.currency ?? 'usd';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger"
        description="Append-only, double-entry record of every financial movement."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Available balance"
          value={formatMoney(balance.data?.available ?? 0, currency)}
          icon={Wallet}
          tone="primary"
          loading={balance.isLoading}
        />
        {balance.data?.accounts?.MERCHANT_BALANCE !== undefined && (
          <StatCard
            label="Merchant balance"
            value={formatMoney(balance.data.accounts.MERCHANT_BALANCE, currency)}
            loading={balance.isLoading}
          />
        )}
        {balance.data?.accounts?.PLATFORM_FEES !== undefined && (
          <StatCard
            label="Platform fees"
            value={formatMoney(balance.data.accounts.PLATFORM_FEES, currency)}
            loading={balance.isLoading}
          />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger entries</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <TableSkeleton columns={COLUMNS} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : data && data.items.length === 0 ? (
            <EmptyState title="No ledger entries" />
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    {COLUMNS.map((c) => (
                      <Th key={c}>{c}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {data?.items.map((e) => {
                    const isDebit = e.direction === 'DEBIT';
                    return (
                      <Tr key={e.id}>
                        <Td className="font-medium">
                          {e.account.replace(/_/g, ' ').toLowerCase()}
                        </Td>
                        <Td>
                          <Badge tone={isDebit ? 'danger' : 'success'}>
                            {isDebit ? (
                              <ArrowUpRight className="h-3 w-3" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3" />
                            )}
                            {e.direction}
                          </Badge>
                        </Td>
                        <Td
                          className={`font-medium tabular-nums ${
                            isDebit ? 'text-destructive' : 'text-success'
                          }`}
                        >
                          {isDebit ? '-' : '+'}
                          {formatMoney(e.amount, e.currency)}
                        </Td>
                        <Td className="font-mono text-xs text-muted-foreground">
                          {shortId(e.transactionId)}
                        </Td>
                        <Td className="max-w-[200px] truncate text-muted-foreground">
                          {e.description || '—'}
                        </Td>
                        <Td className="text-muted-foreground">
                          {formatDateTime(e.createdAt)}
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
              {data && (
                <div className="px-4 pb-1 pt-2">
                  <Pagination meta={data.meta} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
