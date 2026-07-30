import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { asyncHandler, ok } from '../utils/http';
import { serialize } from '../utils/serialize';
import { UnauthorizedError } from '../utils/AppError';

// Aggregates the merchant-facing analytics for the dashboard overview in a
// single round trip. The queries are fired in parallel — they are independent
// and the dashboard is read-heavy, so latency matters more than code brevity.
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const merchantId = req.merchant?.id;
  if (!merchantId) throw new UnauthorizedError();

  const [
    paymentAgg,
    succeededCount,
    failedCount,
    refundAgg,
    customerCount,
    balanceGroups,
    recentPayments,
    recentRefunds,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { merchantId, status: 'succeeded' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.payment.count({ where: { merchantId, status: 'succeeded' } }),
    prisma.payment.count({ where: { merchantId, status: 'failed' } }),
    prisma.refund.aggregate({
      where: { merchantId, status: 'succeeded' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.customer.count({ where: { merchantId } }),
    prisma.ledgerEntry.groupBy({
      by: ['direction'],
      where: { merchantId, account: 'MERCHANT_BALANCE' },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { customer: { select: { name: true, email: true } } },
    }),
    prisma.refund.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  // Balance is derived from the ledger, never stored: credits minus debits on
  // the MERCHANT_BALANCE account. A stored balance can drift; a derived one
  // is always consistent with the entries that justify it.
  const credits = balanceGroups.find((g) => g.direction === 'CREDIT')?._sum.amount ?? 0n;
  const debits = balanceGroups.find((g) => g.direction === 'DEBIT')?._sum.amount ?? 0n;

  ok(
    res,
    serialize({
      grossVolume: paymentAgg._sum.amount ?? 0n,
      paymentsSucceeded: succeededCount,
      paymentsFailed: failedCount,
      refundsTotal: refundAgg._sum.amount ?? 0n,
      refundsCount: refundAgg._count,
      customersCount: customerCount,
      balance: credits - debits,
      currency: 'usd',
      recentPayments,
      recentRefunds,
    }),
  );
});
