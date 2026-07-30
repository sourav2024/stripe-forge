import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../../utils/cn';

export interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: 'default' | 'success' | 'danger' | 'primary';
  loading?: boolean;
}

const iconTones: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'bg-accent text-accent-foreground',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
  primary: 'bg-primary/10 text-primary',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = 'default',
  loading,
}: StatCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight">{value}</p>
          )}
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconTones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
