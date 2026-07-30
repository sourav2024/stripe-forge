import { useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Trash2, Link2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { Dialog } from '../components/ui/Dialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, errorMessage } from '../components/common/ErrorState';
import { TableSkeleton, Skeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import {
  useWebhookEndpoints,
  useWebhookDeliveries,
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useRetryDelivery,
} from '../hooks/useWebhooks';
import type { WebhookEventType } from '../types';
import { formatDateTime } from '../utils/format';

const EVENTS: WebhookEventType[] = [
  'payment.succeeded',
  'payment.failed',
  'payment.processing',
  'refund.created',
];

const DELIVERY_COLUMNS = ['Event', 'Status', 'Attempts', 'Response', 'Created', ''];
const PAGE_SIZE = 10;

export function WebhooksPage() {
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);

  const endpoints = useWebhookEndpoints();
  const deliveries = useWebhookDeliveries({ page, pageSize: PAGE_SIZE });
  const del = useDeleteWebhookEndpoint();
  const retry = useRetryDelivery();
  const toast = useToast();

  async function onDelete(id: string) {
    try {
      await del.mutateAsync(id);
      toast.push('Endpoint deleted', { variant: 'success' });
    } catch (err) {
      toast.push('Delete failed', { variant: 'error', description: errorMessage(err) });
    }
  }

  async function onRetry(id: string) {
    try {
      await retry.mutateAsync(id);
      toast.push('Delivery re-queued', { variant: 'success' });
    } catch (err) {
      toast.push('Retry failed', { variant: 'error', description: errorMessage(err) });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Send real-time event notifications to your endpoints."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Add endpoint
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          {endpoints.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : endpoints.isError ? (
            <ErrorState onRetry={() => endpoints.refetch()} />
          ) : endpoints.data && endpoints.data.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No endpoints"
              description="Add an endpoint to start receiving webhook events."
            />
          ) : (
            <ul className="space-y-3">
              {endpoints.data?.map((ep) => (
                <li
                  key={ep.id}
                  className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-sm">{ep.url}</p>
                      <Badge tone={ep.enabled ? 'success' : 'muted'}>
                        {ep.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {ep.enabledEvents.map((e) => (
                        <Badge key={e} tone="info">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete endpoint"
                    loading={del.isPending && del.variables === ep.id}
                    onClick={() => onDelete(ep.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent deliveries</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {deliveries.isLoading ? (
            <TableSkeleton columns={DELIVERY_COLUMNS} />
          ) : deliveries.isError ? (
            <ErrorState onRetry={() => deliveries.refetch()} />
          ) : deliveries.data && deliveries.data.items.length === 0 ? (
            <EmptyState title="No deliveries yet" />
          ) : (
            <>
              <Table>
                <Thead>
                  <Tr>
                    {DELIVERY_COLUMNS.map((c) => (
                      <Th key={c}>{c}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {deliveries.data?.items.map((d) => (
                    <Tr key={d.id}>
                      <Td className="font-medium">{d.eventType}</Td>
                      <Td>
                        <StatusBadge status={d.status} />
                      </Td>
                      <Td className="tabular-nums text-muted-foreground">{d.attempts}</Td>
                      <Td className="text-muted-foreground">
                        {d.responseStatus ?? '—'}
                      </Td>
                      <Td className="text-muted-foreground">{formatDateTime(d.createdAt)}</Td>
                      <Td>
                        {(d.status === 'failed' || d.status === 'dead') && (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={retry.isPending && retry.variables === d.id}
                            onClick={() => onRetry(d.id)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              {deliveries.data && (
                <div className="px-4 pb-1 pt-2">
                  <Pagination meta={deliveries.data.meta} onPageChange={setPage} />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {creating && <CreateEndpointDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateEndpointDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateWebhookEndpoint();

  const [url, setUrl] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(['payment.succeeded']));

  function toggle(event: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(event)) next.delete(event);
      else next.add(event);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      toast.push('Select at least one event', { variant: 'error' });
      return;
    }
    try {
      await create.mutateAsync({ url, enabledEvents: Array.from(selected) });
      toast.push('Endpoint created', { variant: 'success' });
      onClose();
    } catch (err) {
      toast.push('Could not create endpoint', {
        variant: 'error',
        description: errorMessage(err),
      });
    }
  }

  return (
    <Dialog open onClose={onClose} title="Add webhook endpoint">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="w-url">Endpoint URL</Label>
          <Input
            id="w-url"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://api.example.com/webhooks"
          />
        </div>
        <div className="space-y-2">
          <Label>Events to send</Label>
          <div className="space-y-2 rounded-md border border-border p-3">
            {EVENTS.map((event) => (
              <label
                key={event}
                className="flex cursor-pointer items-center gap-2.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(event)}
                  onChange={() => toggle(event)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                <span className="font-mono">{event}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create endpoint
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
