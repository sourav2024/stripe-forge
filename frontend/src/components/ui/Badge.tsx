import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-accent text-accent-foreground border-border',
  success:
    'bg-success/10 text-success border-success/20 dark:bg-success/15',
  warning:
    'bg-warning/15 text-warning-foreground border-warning/30 dark:text-warning',
  danger:
    'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  muted: 'bg-muted text-muted-foreground border-border',
};

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

// --- Status → tone mapping -------------------------------------------------

const STATUS_TONES: Record<string, Tone> = {
  succeeded: 'success',
  completed: 'success',
  active: 'info',
  processing: 'info',
  pending: 'warning',
  queued: 'warning',
  requires_payment_method: 'warning',
  requires_confirmation: 'warning',
  failed: 'danger',
  dead: 'danger',
  canceled: 'muted',
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral';
  return <Badge tone={tone}>{status.replace(/_/g, ' ')}</Badge>;
}
