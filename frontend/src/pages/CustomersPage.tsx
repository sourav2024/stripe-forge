import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';
import { SearchInput } from '../components/ui/SearchInput';
import { Dialog } from '../components/ui/Dialog';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState, errorMessage } from '../components/common/ErrorState';
import { TableSkeleton } from '../components/ui/Skeleton';
import { Table, Tbody, Td, Th, Thead, Tr } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
} from '../hooks/useCustomers';
import type { Customer } from '../types';
import { formatDate } from '../utils/format';

const PAGE_SIZE = 10;
const COLUMNS = ['Name', 'Email', 'Phone', 'Created', ''];

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const { data, isLoading, isError, refetch } = useCustomers({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage the people you charge."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New customer
          </Button>
        }
      />

      <div className="max-w-sm">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name or email…"
        />
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton columns={COLUMNS} />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : data && data.items.length === 0 ? (
          <EmptyState
            title="No customers found"
            description={search ? 'Try a different search.' : 'Create your first customer to get started.'}
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
                {data?.items.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium">{c.name || '—'}</Td>
                    <Td>{c.email}</Td>
                    <Td className="text-muted-foreground">{c.phone || '—'}</Td>
                    <Td className="text-muted-foreground">{formatDate(c.createdAt)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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

      {(creating || editing) && (
        <CustomerFormDialog
          customer={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteCustomerDialog customer={deleting} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

function CustomerFormDialog({
  customer,
  onClose,
}: {
  customer: Customer | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const isEdit = !!customer;

  const [email, setEmail] = useState(customer?.email ?? '');
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');

  const pending = create.isPending || update.isPending;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = { email, name: name || undefined, phone: phone || undefined };
    try {
      if (isEdit && customer) {
        await update.mutateAsync({ id: customer.id, input });
        toast.push('Customer updated', { variant: 'success' });
      } else {
        await create.mutateAsync(input);
        toast.push('Customer created', { variant: 'success' });
      }
      onClose();
    } catch (err) {
      toast.push('Could not save customer', {
        variant: 'error',
        description: errorMessage(err),
      });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? 'Edit customer' : 'New customer'}
      description={isEdit ? undefined : 'Add a customer to your account.'}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c-email">Email</Label>
          <Input
            id="c-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Name</Label>
          <Input
            id="c-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-phone">Phone</Label>
          <Input
            id="c-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 1234"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteCustomerDialog({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose: () => void;
}) {
  const toast = useToast();
  const del = useDeleteCustomer();

  async function onConfirm() {
    try {
      await del.mutateAsync(customer.id);
      toast.push('Customer deleted', { variant: 'success' });
      onClose();
    } catch (err) {
      toast.push('Could not delete customer', {
        variant: 'error',
        description: errorMessage(err),
      });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Delete customer"
      description={`This will permanently remove ${customer.name || customer.email}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" loading={del.isPending} onClick={onConfirm}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
    </Dialog>
  );
}
