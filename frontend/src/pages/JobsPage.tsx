import { useState } from 'react';
import {
  ListChecks,
  Loader2,
  CheckCircle2,
  XCircle,
  Skull,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { useJobs, useJobStats } from '../hooks/useJobs';
import { formatDateTime, shortId } from '../utils/format';

const PAGE_SIZE = 15;
const COLUMNS = ['Job', 'Queue', 'Name', 'Status', 'Attempts', 'Created'];

export function JobsPage() {
  const [page, setPage] = useState(1);
  const stats = useJobStats();
  const { data, isLoading, isError, refetch } = useJobs({ page, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Background job activity across your queues."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Queued"
          value={String(stats.data?.queued ?? 0)}
          icon={ListChecks}
          loading={stats.isLoading}
        />
        <StatCard
          label="Active"
          value={String(stats.data?.active ?? 0)}
          icon={Loader2}
          tone="primary"
          loading={stats.isLoading}
        />
        <StatCard
          label="Completed"
          value={String(stats.data?.completed ?? 0)}
          icon={CheckCircle2}
          tone="success"
          loading={stats.isLoading}
        />
        <StatCard
          label="Failed"
          value={String(stats.data?.failed ?? 0)}
          icon={XCircle}
          tone="danger"
          loading={stats.isLoading}
        />
        <StatCard
          label="Dead"
          value={String(stats.data?.dead ?? 0)}
          icon={Skull}
          tone="danger"
          loading={stats.isLoading}
        />
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton columns={COLUMNS} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState title="No jobs" description="Background jobs appear here as they run." />
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
                {data?.items.map((j) => (
                  <Tr key={j.id}>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {shortId(j.jobId)}
                    </Td>
                    <Td className="font-medium">{j.queue}</Td>
                    <Td className="text-muted-foreground">{j.name}</Td>
                    <Td>
                      <StatusBadge status={j.status} />
                    </Td>
                    <Td className="tabular-nums text-muted-foreground">{j.attempts}</Td>
                    <Td className="text-muted-foreground">{formatDateTime(j.createdAt)}</Td>
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
