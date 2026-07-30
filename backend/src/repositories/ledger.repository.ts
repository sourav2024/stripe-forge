import { Prisma, LedgerAccount, LedgerDirection } from '@prisma/client';
import { prisma } from '../config/prisma';

// Repository for the append-only, double-entry ledger. Rows are NEVER updated or
// deleted — corrections are new compensating entries. Balances are derived by
// aggregation, never stored, so the ledger is always the single source of truth.

export interface LedgerListParams {
  merchantId: string;
  account?: LedgerAccount;
  transactionId?: string;
  skip: number;
  take: number;
}

export const ledgerRepository = {
  // Bulk-insert the legs of one transaction. Accepts a Prisma transaction client
  // (`tx`) so entry creation is atomic with the payment/refund that produced it.
  createEntries(tx: Prisma.TransactionClient, entries: Prisma.LedgerEntryUncheckedCreateInput[]) {
    return tx.ledgerEntry.createMany({ data: entries });
  },

  async listByMerchant({ merchantId, account, transactionId, skip, take }: LedgerListParams) {
    const where: Prisma.LedgerEntryWhereInput = {
      merchantId,
      ...(account ? { account } : {}),
      ...(transactionId ? { transactionId } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.ledgerEntry.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.ledgerEntry.count({ where }),
    ]);
    return { data, total };
  },

  // Sum amounts grouped by (account, direction) so the service can compute
  // balances as CREDIT-minus-DEBIT per account. Optionally scope to a currency.
  async sumByAccount(
    merchantId: string,
    account: LedgerAccount,
    currency?: string,
  ): Promise<Array<{ direction: LedgerDirection; _sum: { amount: bigint | null } }>> {
    const rows = await prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { merchantId, account, ...(currency ? { currency } : {}) },
      _sum: { amount: true },
      orderBy: { direction: 'asc' },
    });
    return rows;
  },
};
