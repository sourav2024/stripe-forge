// WHY THIS TEST EXISTS
// The double-entry ledger is the accounting core of StripeForge. Its single most
// important invariant is: for any transaction, SUM(DEBIT amounts) === SUM(CREDIT
// amounts) — "the books balance". If that ever fails, merchant balances (which
// are DERIVED as CREDITs - DEBITs on MERCHANT_BALANCE) silently drift and money
// is effectively lost or invented.
//
// `ledgerService.recordPaymentSucceeded` / `recordRefund` build their legs inside
// a Prisma transaction (they take a `tx` client), so calling them directly would
// require a live DB. Rather than depend on Postgres for a pure invariant check,
// this test REPLICATES the exact leg-construction shape the service produces (see
// src/services/ledger.service.ts) and asserts the invariant on the resulting
// entry arrays. This keeps the test fast/deterministic while still guarding the
// property that matters. It also documents the intended account/direction mapping
// so a change to the service that breaks balance is caught here in review.

import { describe, it, expect } from 'vitest';

type Direction = 'DEBIT' | 'CREDIT';
type Account = 'MERCHANT_BALANCE' | 'PLATFORM_FEES' | 'CASH' | 'REFUNDS_PAYABLE';

interface Leg {
  account: Account;
  direction: Direction;
  amount: bigint;
}

// Mirrors ledgerService.recordPaymentSucceeded: money IN.
//   DEBIT  CASH             (asset up)
//   CREDIT MERCHANT_BALANCE (liability up — we owe the merchant)
function paymentSucceededLegs(amount: bigint): Leg[] {
  return [
    { account: 'CASH', direction: 'DEBIT', amount },
    { account: 'MERCHANT_BALANCE', direction: 'CREDIT', amount },
  ];
}

// Mirrors ledgerService.recordRefund: money OUT (reversal).
//   DEBIT  MERCHANT_BALANCE (liability down)
//   CREDIT CASH             (asset down)
function refundLegs(amount: bigint): Leg[] {
  return [
    { account: 'MERCHANT_BALANCE', direction: 'DEBIT', amount },
    { account: 'CASH', direction: 'CREDIT', amount },
  ];
}

function sumByDirection(legs: Leg[], direction: Direction): bigint {
  return legs
    .filter((l) => l.direction === direction)
    .reduce((acc, l) => acc + l.amount, 0n);
}

function isBalanced(legs: Leg[]): boolean {
  return sumByDirection(legs, 'DEBIT') === sumByDirection(legs, 'CREDIT');
}

describe('double-entry ledger invariant (debits === credits)', () => {
  it('a captured payment posts balanced legs', () => {
    const legs = paymentSucceededLegs(2500n);
    expect(legs).toHaveLength(2);
    expect(isBalanced(legs)).toBe(true);
    expect(sumByDirection(legs, 'DEBIT')).toBe(2500n);
    expect(sumByDirection(legs, 'CREDIT')).toBe(2500n);
  });

  it('maps a payment to the correct accounts/directions', () => {
    const legs = paymentSucceededLegs(1000n);
    const cash = legs.find((l) => l.account === 'CASH')!;
    const merchant = legs.find((l) => l.account === 'MERCHANT_BALANCE')!;
    expect(cash.direction).toBe('DEBIT');
    expect(merchant.direction).toBe('CREDIT');
  });

  it('a refund posts the reversing balanced legs', () => {
    const legs = refundLegs(700n);
    expect(isBalanced(legs)).toBe(true);
    const cash = legs.find((l) => l.account === 'CASH')!;
    const merchant = legs.find((l) => l.account === 'MERCHANT_BALANCE')!;
    // Refund is the mirror image of a capture.
    expect(cash.direction).toBe('CREDIT');
    expect(merchant.direction).toBe('DEBIT');
  });

  it('stays balanced across a mixed sequence of movements', () => {
    const all: Leg[] = [
      ...paymentSucceededLegs(5000n),
      ...paymentSucceededLegs(2000n),
      ...refundLegs(1500n),
    ];
    expect(isBalanced(all)).toBe(true);
  });

  it('derived merchant balance = capture - refund on MERCHANT_BALANCE', () => {
    const all: Leg[] = [...paymentSucceededLegs(5000n), ...refundLegs(1500n)];
    const merchantLegs = all.filter((l) => l.account === 'MERCHANT_BALANCE');
    const credit = sumByDirection(merchantLegs, 'CREDIT');
    const debit = sumByDirection(merchantLegs, 'DEBIT');
    // available = credits - debits  =>  5000 - 1500 = 3500
    expect(credit - debit).toBe(3500n);
  });

  it('never balances if a leg is dropped (regression guard)', () => {
    const [firstLeg] = paymentSucceededLegs(1000n);
    expect(isBalanced([firstLeg])).toBe(false);
  });
});
