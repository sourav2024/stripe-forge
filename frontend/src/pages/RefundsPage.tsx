import { useState } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { useRefunds } from '../hooks/useRefunds';
import { formatMoney, formatDateTime, shortId } from '../utils/format';

const PAGE_SIZE = 10;
const COLUMNS = ['ID', 'Payment', 'Amount', 'Status', 'Reason', 'Created'];

export function RefundsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useRefunds({ page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <PageHeader title="Refunds" description="Money returned to your customers." />

      <Card>
        {isLoading ? (
          <TableSkeleton columns={COLUMNS} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No refunds" description="Refunds you issue will appear here." />
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
                {data?.items.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {shortId(r.id)}
                    </Td>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {shortId(r.paymentId)}
                    </Td>
                    <Td className="font-medium tabular-nums">
                      {formatMoney(r.amount, r.currency)}
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className="max-w-[200px] truncate text-muted-foreground">
                      {r.reason || '—'}
                    </Td>
                    <Td className="text-muted-foreground">{formatDateTime(r.createdAt)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            {data && (
              <div className="px-4 pb-4">
                <Pagination meta={data.meta} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
