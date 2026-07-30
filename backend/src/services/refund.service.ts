import { PaymentStatus, RefundStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { refundRepository } from '../repositories/refund.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { paymentService } from './payment.service';
import { ledgerService } from './ledger.service';
import { BadRequestError, NotFoundError } from '../utils/AppError';
import { emitDomainEvent } from '../events/emit';
import { enqueueReceipt } from '../events/enqueue';

export const refundService = {
  // Full or partial refund. Amount defaults to the remaining refundable balance.
  // The Refund row, the payment's amountRefunded increment, and the reversing
  // ledger legs all commit atomically so the books can never go out of balance.
  async createRefund(args: {
    merchantId: string;
    paymentId: string;
    amount?: number;
    reason?: string;
  }) {
    const { merchantId, paymentId, amount, reason } = args;

    // Scoped load — a merchant can only refund its own payments.
    const payment = await paymentService.retrievePayment(merchantId, paymentId);

    if (payment.status !== PaymentStatus.succeeded) {
      throw new BadRequestError('Only succeeded payments can be refunded');
    }

    const remaining = payment.amount - payment.amountRefunded;
    const refundAmount = amount !== undefined ? BigInt(amount) : remaining;

    if (refundAmount <= 0n) {
      throw new BadRequestError('Refund amount must be greater than zero');
    }
    // Cheap pre-check to fail fast in the common case. NOT authoritative: two
    // concurrent refunds can both read the same `remaining` and both pass here,
    // so the real guard is the atomic conditional UPDATE inside the transaction.
    if (refundAmount > remaining) {
      throw new BadRequestError('refund_exceeds_available');
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await refundRepository.create(tx, {
        merchantId,
        paymentId,
        amount: refundAmount,
        currency: payment.currency,
        // Simulation captures instantly; a real processor would start pending.
        status: RefundStatus.succeeded,
        reason,
      });
      // Authoritative over-refund guard: only increments if the total stays
      // within the payment amount. 0 rows affected => a concurrent refund got
      // there first, so roll the whole transaction back (Refund row + legs).
      const affected = await paymentRepository.tryIncrementAmountRefunded(
        tx,
        paymentId,
        refundAmount,
      );
      if (affected === 0) {
        throw new BadRequestError('refund_exceeds_available');
      }
      await ledgerService.recordRefund(tx, {
        merchantId,
        paymentId,
        refundId: created.id,
        amount: refundAmount,
        currency: payment.currency,
      });
      return created;
    });

    // Side effects after commit so a rolled-back refund never emits an event.
    await emitDomainEvent(merchantId, 'refund.created', {
      refundId: refund.id,
      paymentId,
      amount: Number(refund.amount),
      currency: refund.currency,
    });
    // Shape matches ReceiptJobData (Agent C): { paymentId, merchantId, amount, currency }.
    await enqueueReceipt({
      merchantId,
      paymentId,
      amount: Number(refund.amount),
      currency: refund.currency,
    });

    return refund;
  },

  async retrieveRefund(merchantId: string, id: string) {
    const refund = await refundRepository.findById(merchantId, id);
    if (!refund) {
      throw new NotFoundError('Refund not found');
    }
    return refund;
  },

  listRefunds(params: {
    merchantId: string;
    status?: RefundStatus;
    skip: number;
    take: number;
  }) {
    return refundRepository.list(params);
  },
};
