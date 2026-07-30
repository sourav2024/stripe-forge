import { useState, type FormEvent } from 'react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Textarea } from '../components/ui/Textarea';
import { SearchInput } from '../components/ui/SearchInput';
import { Drawer } from '../components/ui/Drawer';
import { Dialog } from '../components/ui/Dialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, errorMessage } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { PageSpinner } from '../components/ui/Spinner';
import { useToast } from '../components/ui/Toast';
import { usePayments, usePayment } from '../hooks/usePayments';
import { useCreateRefund } from '../hooks/useRefunds';
import type { Payment } from '../types';
import { formatMoney, formatDateTime, shortId } from '../utils/format';

const PAGE_SIZE = 10;
const COLUMNS = ['ID', 'Amount', 'Refunded', 'Status', 'Created'];

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = usePayments({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Every charge processed on your account." />

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search payments…"
        />
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton columns={COLUMNS} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No payments"
            description="Payments appear here once a payment intent succeeds."
          />
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
                {data?.items.map((p) => (
                  <Tr key={p.id} clickable onClick={() => setSelectedId(p.id)}>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {shortId(p.id)}
                    </Td>
                    <Td className="font-medium tabular-nums">
                      {formatMoney(p.amount, p.currency)}
                    </Td>
                    <Td className="tabular-nums text-muted-foreground">
                      {p.amountRefunded > 0 ? formatMoney(p.amountRefunded, p.currency) : '—'}
                    </Td>
                    <Td>
                      <StatusBadge status={p.status} />
                    </Td>
                    <Td className="text-muted-foreground">{formatDateTime(p.createdAt)}</Td>
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

      <PaymentDetailDrawer
        paymentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function PaymentDetailDrawer({
  paymentId,
  onClose,
}: {
  paymentId: string | null;
  onClose: () => void;
}) {
  const { data: payment, isLoading } = usePayment(paymentId);
  const [refunding, setRefunding] = useState(false);

  const refundable = payment
    ? payment.status === 'succeeded' && payment.amountRefunded < payment.amount
    : false;

  return (
    <Drawer open={!!paymentId} onClose={onClose} title="Payment details">
      {isLoading || !payment ? (
        <PageSpinner />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-3xl font-semibold tracking-tight">
              {formatMoney(payment.amount, payment.currency)}
            </p>
            <div className="mt-2">
              <StatusBadge status={payment.status} />
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <Field label="Payment ID" value={payment.id} mono />
            <Field label="Payment intent" value={payment.paymentIntentId} mono />
            <Field
              label="Amount refunded"
              value={formatMoney(payment.amountRefunded, payment.currency)}
            />
            <Field label="Currency" value={payment.currency.toUpperCase()} />
            <Field label="Created" value={formatDateTime(payment.createdAt)} />
          </dl>

          {refundable && (
            <Button className="w-full" onClick={() => setRefunding(true)}>
              Refund payment
            </Button>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold">Refunds</h4>
            {!payment.refunds || payment.refunds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No refunds for this payment.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {payment.refunds.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {shortId(r.id)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} />
                      <span className="text-sm font-medium tabular-nums">
                        {formatMoney(r.amount, r.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {refunding && (
            <RefundDialog payment={payment} onClose={() => setRefunding(false)} />
          )}
        </div>
      )}
    </Drawer>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'break-all text-right font-mono text-xs' : 'text-right'}>
        {value}
      </dd>
    </div>
  );
}

function RefundDialog({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateRefund();
  const remaining = payment.amount - payment.amountRefunded;

  const [full, setFull] = useState(true);
  const [amount, setAmount] = useState((remaining / 100).toFixed(2));
  const [reason, setReason] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    let minor: number | undefined;
    if (!full) {
      minor = Math.round(parseFloat(amount) * 100);
      if (!Number.isFinite(minor) || minor <= 0 || minor > remaining) {
        toast.push('Enter a valid refund amount', {
          variant: 'error',
          description: `Must be between 0 and ${formatMoney(remaining, payment.currency)}.`,
        });
        return;
      }
    }
    try {
      await create.mutateAsync({
        paymentId: payment.id,
        amount: minor,
        reason: reason || undefined,
      });
      toast.push('Refund created', { variant: 'success' });
      onClose();
    } catch (err) {
      toast.push('Refund failed', { variant: 'error', description: errorMessage(err) });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Refund payment"
      description={`Up to ${formatMoney(remaining, payment.currency)} available to refund.`}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFull(true)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              full ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
            }`}
          >
            Full refund
          </button>
          <button
            type="button"
            onClick={() => setFull(false)}
            className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              !full ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
            }`}
          >
            Partial refund
          </button>
        </div>

        {!full && (
          <div className="space-y-1.5">
            <Label htmlFor="r-amount">Amount</Label>
            <Input
              id="r-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="r-reason">Reason (optional)</Label>
          <Textarea
            id="r-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Requested by customer"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            {full
              ? `Refund ${formatMoney(remaining, payment.currency)}`
              : 'Issue refund'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
