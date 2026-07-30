import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../utils/cn';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastOptions {
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  push: (title: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (title: string, options?: ToastOptions) => {
      const id = nextId++;
      const item: ToastItem = {
        id,
        title,
        description: options?.description,
        variant: options?.variant ?? 'info',
      };
      setItems((prev) => [...prev, item]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
          {items.map((t) => (
            <ToastCard key={t.id} item={t} onClose={() => remove(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
} as const;

const accents: Record<ToastVariant, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-primary',
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const Icon = icons[item.variant];
  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-pop animate-fade-in">
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', accents[item.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        {item.description && (
          <p className="mt-0.5 break-words text-sm text-muted-foreground">
            {item.description}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
