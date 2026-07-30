import { cn } from '../../utils/cn';
import { Table, Tbody, Td, Th, Thead, Tr } from './Table';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />;
}

export function TableSkeleton({
  columns,
  rows = 6,
}: {
  columns: string[];
  rows?: number;
}) {
  return (
    <Table>
      <Thead>
        <Tr>
          {columns.map((c) => (
            <Th key={c}>{c}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <Tr key={r}>
            {columns.map((c) => (
              <Td key={c}>
                <Skeleton className="h-4 w-full max-w-[140px]" />
              </Td>
            ))}
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
