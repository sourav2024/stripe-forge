import { Prisma, LedgerAccount, LedgerDirection } from '@prisma/client';
import { ledgerRepository } from '../repositories/ledger.repository';
import { generateToken } from '../utils/crypto';

// =============================================================================
// DOUBLE-ENTRY LEDGER — the accounting core of StripeForge.
//
// WHY double-entry: every movement of money touches at least two accounts, and
// the sum of DEBITs must always equal the sum of CREDITs for a given
// transaction. This invariant ("the books balance") makes the ledger
// self-auditing: if any single leg is missing or wrong, the transaction no
// longer sums to zero and reconciliation catches it. We never store a mutable
// "balance" column; balances are always DERIVED from the immutable entries, so
// there is exactly one source of truth and no chance of a cached balance
// drifting away from reality.
//
// SIGN CONVENTION used here (deliberately simplified for teaching):
//   - We treat MERCHANT_BALANCE as a liability we owe the merchant, so a CREDIT
//     increases it and a DEBIT decreases it.
//   - CASH is the platform's asset account representing money actually received.
//
// A successful payment moves money IN:
//   DEBIT  CASH             (asset up — we now hold the funds)
//   CREDIT MERCHANT_BALANCE (liability up — we owe the merchant that amount)
//
// A refund reverses it, moving money OUT:
//   DEBIT  MERCHANT_BALANCE (liability down — we owe the merchant less)
//   CREDIT CASH             (asset down — funds leave)
//
// Each pair shares one `transactionId` and the two legs are equal in amount, so
// debits == credits and the transaction nets to zero. Entries are written with
// the caller's Prisma transaction client (`tx`) so they commit atomically with
// the payment/refund row that caused them — you can never have a payment without
// its ledger legs, or vice versa.
// =============================================================================

interface RecordPaymentArgs {
  merchantId: string;
  paymentId: string;
  amount: bigint;
  currency: string;
}

interface RecordRefundArgs {
  merchantId: string;
  paymentId: string;
  refundId: string;
  amount: bigint;
  currency: string;
}

export const ledgerService = {
  // Post the two balanced legs for a captured payment. Runs inside the caller's
  // transaction so it is atomic with marking the Payment succeeded.
  async recordPaymentSucceeded(tx: Prisma.TransactionClient, args: RecordPaymentArgs) {
    const { merchantId, paymentId, amount, currency } = args;
    const transactionId = generateToken(16);

    const legs: Prisma.LedgerEntryUncheckedCreateInput[] = [
      {
        merchantId,
        transactionId,
        account: LedgerAccount.CASH,
        direction: LedgerDirection.DEBIT,
        amount,
        currency,
        paymentId,
        description: 'Payment captured — cash received',
      },
      {
        merchantId,
        transactionId,
        account: LedgerAccount.MERCHANT_BALANCE,
        direction: LedgerDirection.CREDIT,
        amount,
        currency,
        paymentId,
        description: 'Payment captured — merchant balance credited',
      },
    ];

    await ledgerRepository.createEntries(tx, legs);
    return transactionId;
  },

  // Post the reversing legs for a refund (full or partial). New transactionId —
  // corrections are additive, we never touch the original entries.
  async recordRefund(tx: Prisma.TransactionClient, args: RecordRefundArgs) {
    const { merchantId, paymentId, refundId, amount, currency } = args;
    const transactionId = generateToken(16);

    const legs: Prisma.LedgerEntryUncheckedCreateInput[] = [
      {
        merchantId,
        transactionId,
        account: LedgerAccount.MERCHANT_BALANCE,
        direction: LedgerDirection.DEBIT,
        amount,
        currency,
        paymentId,
        refundId,
        description: 'Refund issued — merchant balance debited',
      },
      {
        merchantId,
        transactionId,
        account: LedgerAccount.CASH,
        direction: LedgerDirection.CREDIT,
        amount,
        currency,
        paymentId,
        refundId,
        description: 'Refund issued — cash paid out',
      },
    ];

    await ledgerRepository.createEntries(tx, legs);
    return transactionId;
  },

  // Available balance = what we owe the merchant = CREDITs - DEBITs on the
  // MERCHANT_BALANCE account. Derived purely from immutable entries.
  async getMerchantBalance(merchantId: string, currency = 'usd') {
    const grouped = await ledgerRepository.sumByAccount(
      merchantId,
      LedgerAccount.MERCHANT_BALANCE,
      currency,
    );

    let credit = 0n;
    let debit = 0n;
    for (const row of grouped) {
      const sum = row._sum.amount ?? 0n;
      if (row.direction === LedgerDirection.CREDIT) credit += sum;
      else debit += sum;
    }

    return { available: credit - debit, currency };
  },

  getLedgerHistory(opts: {
    merchantId: string;
    account?: LedgerAccount;
    transactionId?: string;
    skip: number;
    take: number;
  }) {
    return ledgerRepository.listByMerchant(opts);
  },
};
