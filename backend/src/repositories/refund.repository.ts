import { Prisma, RefundStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface RefundListParams {
  merchantId: string;
  status?: RefundStatus;
  skip: number;
  take: number;
}

export const refundRepository = {
  // Created inside the refund transaction alongside the ledger legs.
  create(tx: Prisma.TransactionClient, data: Prisma.RefundUncheckedCreateInput) {
    return tx.refund.create({ data });
  },

  findById(merchantId: string, id: string) {
    return prisma.refund.findFirst({ where: { id, merchantId } });
  },

  listByPayment(merchantId: string, paymentId: string) {
    return prisma.refund.findMany({
      where: { merchantId, paymentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async list({ merchantId, status, skip, take }: RefundListParams) {
    const where: Prisma.RefundWhereInput = { merchantId, ...(status ? { status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.refund.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.refund.count({ where }),
    ]);
    return { data, total };
  },
};
