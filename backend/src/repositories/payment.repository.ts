import { Prisma, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface PaymentListParams {
  merchantId: string;
  status?: PaymentStatus;
  skip: number;
  take: number;
}

export const paymentRepository = {
  // Payment rows are created inside the confirm transaction, so creation accepts
  // a transaction client to stay atomic with the intent state change.
  create(tx: Prisma.TransactionClient, data: Prisma.PaymentUncheckedCreateInput) {
    return tx.payment.create({ data });
  },

  updateStatus(tx: Prisma.TransactionClient, id: string, status: PaymentStatus) {
    return tx.payment.update({ where: { id }, data: { status } });
  },

  findById(merchantId: string, id: string) {
    return prisma.payment.findFirst({ where: { id, merchantId } });
  },

  // Used by the refund flow, inside its transaction. The increment and the
  // "won't exceed the payment amount" guard are a SINGLE atomic UPDATE: the
  // `amountRefunded + amount <= amount` predicate is evaluated by the DB under
  // row locks, so two concurrent refunds cannot both pass and over-refund
  // (the loser sees 0 affected rows). Prisma's typed updateMany can't express
  // a column-vs-column arithmetic predicate, so raw parameterized SQL is used.
  // Returns the number of rows updated (1 = claimed, 0 = would over-refund /
  // not succeeded / not found).
  tryIncrementAmountRefunded(tx: Prisma.TransactionClient, id: string, amount: bigint) {
    return tx.$executeRaw`
      UPDATE "payments"
      SET "amountRefunded" = "amountRefunded" + ${amount}, "updatedAt" = NOW()
      WHERE "id" = ${id}
        AND "status" = 'succeeded'::"PaymentStatus"
        AND "amountRefunded" + ${amount} <= "amount"
    `;
  },

  async list({ merchantId, status, skip, take }: PaymentListParams) {
    const where: Prisma.PaymentWhereInput = { merchantId, ...(status ? { status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.payment.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.payment.count({ where }),
    ]);
    return { data, total };
  },
};
