import { useState, type FormEvent } from 'react';
import { Plus, Check, X as XIcon } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { Dialog } from '../components/ui/Dialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, errorMessage } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { StatusBadge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import {
  usePaymentIntents,
  useCreatePaymentIntent,
  useConfirmPaymentIntent,
  useCancelPaymentIntent,
} from '../hooks/usePaymentIntents';
import { useCustomers } from '../hooks/useCustomers';
import type { PaymentIntent, PaymentIntentStatus } from '../types';
import { formatMoney, formatDate, shortId } from '../utils/format';

const PAGE_SIZE = 10;
const COLUMNS = ['ID', 'Amount', 'Status', 'Description', 'Created', ''];

// Confirm is only meaningful before terminal/processing states; cancel likewise.
const CONFIRMABLE: PaymentIntentStatus[] = [
  'requires_payment_method',
  'requires_confirmation',
];
const CANCELABLE: PaymentIntentStatus[] = [
  'requires_payment_method',
  'requires_confirmation',
  'processing',
];

export function PaymentIntentsPage() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, isError, refetch } = usePaymentIntents({
    page,
    pageSize: PAGE_SIZE,
  });

  const confirm = useConfirmPaymentIntent();
  const cancel = useCancelPaymentIntent();
  const toast = useToast();

  async function onConfirm(pi: PaymentIntent) {
    try {
      await confirm.mutateAsync(pi.id);
      toast.push('Payment intent confirmed', { variant: 'success' });
    } catch (err) {
      toast.push('Confirm failed', { variant: 'error', description: errorMessage(err) });
    }
  }

  async function onCancel(pi: PaymentIntent) {
    try {
      await cancel.mutateAsync(pi.id);
      toast.push('Payment intent canceled', { variant: 'success' });
    } catch (err) {
      toast.push('Cancel failed', { variant: 'error', description: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Intents"
        description="Create and drive payments through their lifecycle."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Create payment intent
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton columns={COLUMNS} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No payment intents"
            description="Create a payment intent to begin collecting a payment."
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
                {data?.items.map((pi) => (
                  <Tr key={pi.id}>
                    <Td className="font-mono text-xs text-muted-foreground">
                      {shortId(pi.id)}
                    </Td>
                    <Td className="font-medium tabular-nums">
                      {formatMoney(pi.amount, pi.currency)}
                    </Td>
                    <Td>
                      <StatusBadge status={pi.status} />
                    </Td>
                    <Td className="max-w-[200px] truncate text-muted-foreground">
                      {pi.description || '—'}
                    </Td>
                    <Td className="text-muted-foreground">{formatDate(pi.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        {CONFIRMABLE.includes(pi.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={confirm.isPending && confirm.variables === pi.id}
                            onClick={() => onConfirm(pi)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Confirm
                          </Button>
                        )}
                        {CANCELABLE.includes(pi.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={cancel.isPending && cancel.variables === pi.id}
                            onClick={() => onCancel(pi)}
                          >
                            <XIcon className="h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </Td>
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

      {creating && <CreatePaymentIntentDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreatePaymentIntentDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreatePaymentIntent();
  const { data: customers } = useCustomers({ page: 1, pageSize: 100 });

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const minor = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(minor) || minor <= 0) {
      toast.push('Enter a valid amount', { variant: 'error' });
      return;
    }
    try {
      await create.mutateAsync({
        amount: minor,
        currency,
        customerId: customerId || undefined,
        description: description || undefined,
      });
      toast.push('Payment intent created', { variant: 'success' });
      onClose();
    } catch (err) {
      toast.push('Could not create payment intent', {
        variant: 'error',
        description: errorMessage(err),
      });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Create payment intent"
      description="Amounts are entered in major units (e.g. dollars)."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="pi-amount">Amount</Label>
            <Input
              id="pi-amount"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="49.99"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pi-currency">Currency</Label>
            <Select
              id="pi-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="usd">USD</option>
              <option value="eur">EUR</option>
              <option value="gbp">GBP</option>
              <option value="inr">INR</option>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-customer">Customer (optional)</Label>
          <Select
            id="pi-customer"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">No customer</option>
            {customers?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ? `${c.name} (${c.email})` : c.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pi-desc">Description (optional)</Label>
          <Textarea
            id="pi-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Order #1234"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
