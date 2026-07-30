import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import type { PaginationMeta } from '../../types';

export interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const totalPages =
    meta.totalPages ?? Math.max(1, Math.ceil(meta.total / (meta.pageSize || 1)));
  const page = meta.page;
  const from = meta.total === 0 ? 0 : (page - 1) * meta.pageSize + 1;
  const to = Math.min(page * meta.pageSize, meta.total);

  return (
    <div className="flex items-center justify-between px-1 pt-3 text-sm">
      <p className="text-muted-foreground">
        {meta.total === 0 ? 'No results' : `${from}–${to} of ${meta.total}`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
