import { cn } from '../../utils/cn';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-subtle">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="currentColor">
          <path d="M15.5 8c-3 0-5 1.6-5 4.2 0 4.7 6.6 3.6 6.6 5.9 0 .9-.8 1.4-2 1.4-1.6 0-3.6-.8-5-1.7v3.7c1.5.8 3.3 1.2 5 1.2 3.1 0 5.2-1.6 5.2-4.3 0-4.9-6.7-3.9-6.7-6 0-.8.7-1.2 1.8-1.2 1.5 0 3.4.6 4.7 1.4V9c-1.3-.6-2.9-1-4.6-1z" />
        </svg>
      </div>
      <span className="text-lg font-semibold tracking-tight">StripeForge</span>
    </div>
  );
}
