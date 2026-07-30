import { Prisma, PaymentIntentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { generateToken } from '../utils/crypto';

export interface PaymentIntentListParams {
  merchantId: string;
  status?: PaymentIntentStatus;
  skip: number;
  take: number;
}

export const paymentIntentRepository = {
  create(data: Omit<Prisma.PaymentIntentUncheckedCreateInput, 'clientSecret'>) {
    // The client secret is a bearer credential the frontend uses to reference
    // this intent without exposing merchant API keys. Random, unguessable.
    const clientSecret = `pi_secret_${generateToken(24)}`;
    return prisma.paymentIntent.create({ data: { ...data, clientSecret } });
  },

  findById(merchantId: string, id: string) {
    return prisma.paymentIntent.findFirst({ where: { id, merchantId } });
  },

  findByIdempotencyKey(merchantId: string, idempotencyKey: string) {
    return prisma.paymentIntent.findFirst({ where: { merchantId, idempotencyKey } });
  },

  async list({ merchantId, status, skip, take }: PaymentIntentListParams) {
    const where: Prisma.PaymentIntentWhereInput = { merchantId, ...(status ? { status } : {}) };
    const [data, total] = await prisma.$transaction([
      prisma.paymentIntent.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.paymentIntent.count({ where }),
    ]);
    return { data, total };
  },

  // Non-transactional status update (e.g. cancel). Money-moving transitions use
  // the transaction-aware variant below.
  updateStatus(merchantId: string, id: string, status: PaymentIntentStatus) {
    return prisma.paymentIntent.updateMany({ where: { id, merchantId }, data: { status } });
  },

  updateStatusTx(tx: Prisma.TransactionClient, id: string, status: PaymentIntentStatus) {
    return tx.paymentIntent.update({ where: { id }, data: { status } });
  },

  // Atomic confirmation claim: flips a confirmable intent to `processing` in a
  // single conditional UPDATE. Only ONE of N concurrent confirms matches the
  // status guard and gets count===1; the rest get 0 and must bail, so we never
  // create two Payments / two ledger pairs for one intent. Returns rows updated.
  async claimForConfirmation(merchantId: string, id: string): Promise<number> {
    const { count } = await prisma.paymentIntent.updateMany({
      where: {
        id,
        merchantId,
        status: {
          in: [
            PaymentIntentStatus.requires_payment_method,
            PaymentIntentStatus.requires_confirmation,
          ],
        },
      },
      data: { status: PaymentIntentStatus.processing },
    });
    return count;
  },

  // Compensation for a failed money transaction: return the intent from the
  // `processing` we claimed back to `requires_confirmation` so a crash mid-txn
  // doesn't strand it in a non-confirmable, non-terminal state forever. Guarded
  // on status='processing' so it can't clobber a concurrently-finalized state.
  async resetProcessingToConfirmable(merchantId: string, id: string): Promise<number> {
    const { count } = await prisma.paymentIntent.updateMany({
      where: { id, merchantId, status: PaymentIntentStatus.processing },
      data: { status: PaymentIntentStatus.requires_confirmation },
    });
    return count;
  },

  // Atomic cancel claim: canceling is only valid from a non-terminal state, so
  // the terminal-exclusion guard lives in the UPDATE. count===0 means the intent
  // is already terminal (or gone) and the caller should reject.
  async claimForCancellation(merchantId: string, id: string): Promise<number> {
    const { count } = await prisma.paymentIntent.updateMany({
      where: {
        id,
        merchantId,
        status: {
          notIn: [
            PaymentIntentStatus.succeeded,
            PaymentIntentStatus.failed,
            PaymentIntentStatus.canceled,
          ],
        },
      },
      data: { status: PaymentIntentStatus.canceled },
    });
    return count;
  },
};
