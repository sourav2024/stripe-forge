import { Prisma, PaymentIntentStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { paymentIntentRepository } from '../repositories/paymentIntent.repository';
import { paymentRepository } from '../repositories/payment.repository';
import { customerRepository } from '../repositories/customer.repository';
import { ledgerService } from './ledger.service';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/AppError';
import { emitDomainEvent } from '../events/emit';
import { enqueueReceipt } from '../events/enqueue';

// =============================================================================
// PaymentIntent state machine (mirrors Stripe, simplified):
//
//   requires_payment_method ──attach PM──▶ requires_confirmation
//            │                                      │
//            └──────────────── confirm ────────────┤
//                                                   ▼
//                                              processing
//                                              │        │
//                                        succeed      fail
//                                              ▼        ▼
//                                        succeeded   failed
//
//   any non-terminal ──cancel──▶ canceled
//
// Terminal states: succeeded, failed, canceled. No transitions leave them.
// =============================================================================

// An idempotency key is scoped to the exact request that first used it. Replaying
// it with different money is a client bug, not a retry — reject instead of
// silently returning an intent for a different amount/currency.
function assertIdempotentMatch(
  existing: { amount: bigint; currency: string },
  amount: number,
  currency: string,
): void {
  if (existing.amount !== BigInt(amount) || existing.currency !== currency) {
    throw new ConflictError('idempotency_key_reuse_with_different_parameters');
  }
}

export const paymentIntentService = {
  async createPaymentIntent(args: {
    merchantId: string;
    amount: number;
    currency: string;
    customerId?: string;
    description?: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const { merchantId, amount, currency, customerId, description, metadata, idempotencyKey } = args;

    if (amount <= 0) throw new BadRequestError('Amount must be greater than zero');

    // Idempotency: a client retry carrying the same key must return the original
    // intent, never create a duplicate charge.
    if (idempotencyKey) {
      const existing = await paymentIntentRepository.findByIdempotencyKey(merchantId, idempotencyKey);
      if (existing) {
        assertIdempotentMatch(existing, amount, currency);
        return existing;
      }
    }

    // A referenced customer must belong to this merchant (tenant isolation).
    if (customerId) {
      const customer = await customerRepository.findById(merchantId, customerId);
      if (!customer) throw new NotFoundError('Customer not found');
    }

    try {
      return await paymentIntentRepository.create({
        merchantId,
        amount: BigInt(amount),
        currency,
        customerId,
        description,
        metadata: metadata as Prisma.InputJsonValue | undefined,
        idempotencyKey,
        status: PaymentIntentStatus.requires_payment_method,
      });
    } catch (err) {
      // Concurrent requests with the same idempotency key race the unique index.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        if (idempotencyKey) {
          const existing = await paymentIntentRepository.findByIdempotencyKey(
            merchantId,
            idempotencyKey,
          );
          if (existing) {
            assertIdempotentMatch(existing, amount, currency);
            return existing;
          }
        }
        throw new ConflictError('Duplicate payment intent');
      }
      throw err;
    }
  },

  async retrievePaymentIntent(merchantId: string, id: string) {
    const intent = await paymentIntentRepository.findById(merchantId, id);
    if (!intent) throw new NotFoundError('Payment intent not found');
    return intent;
  },

  listPaymentIntents(params: {
    merchantId: string;
    status?: PaymentIntentStatus;
    skip: number;
    take: number;
  }) {
    return paymentIntentRepository.list(params);
  },

  // Drive the intent through processing → succeeded|failed. The money-moving
  // work (payment row + ledger legs + terminal status) is one DB transaction so
  // it is all-or-nothing. Events/receipts are fired AFTER commit so a rolled-back
  // transaction never leaks a webhook.
  async confirmPaymentIntent(merchantId: string, id: string) {
    const intent = await this.retrievePaymentIntent(merchantId, id);

    // Atomic claim: flip confirmable -> processing in one conditional UPDATE.
    // This is what serializes concurrent confirms — only the winner gets count
    // 1 and proceeds to move money; every other caller (and any confirm of an
    // already-processing/terminal intent) gets 0 and is rejected here, so we
    // never mint two Payments / two ledger pairs for the same intent.
    const claimed = await paymentIntentRepository.claimForConfirmation(merchantId, id);
    if (claimed === 0) {
      throw new BadRequestError(
        `Cannot confirm a payment intent in status "${intent.status}"`,
      );
    }

    await emitDomainEvent(merchantId, 'payment.processing', { paymentIntentId: id });

    // Deterministic test rule for the simulation: fail on the magic amount 42 or
    // an explicit metadata flag. Everything else succeeds.
    const meta = (intent.metadata as Record<string, unknown> | null) ?? {};
    const shouldFail = meta.simulate === 'fail' || intent.amount === 42n;

    if (shouldFail) {
      let result;
      try {
        result = await prisma.$transaction(async (tx) => {
          const payment = await paymentRepository.create(tx, {
            merchantId,
            paymentIntentId: id,
            customerId: intent.customerId,
            amount: intent.amount,
            currency: intent.currency,
            status: PaymentStatus.failed,
          });
          await paymentIntentRepository.updateStatusTx(tx, id, PaymentIntentStatus.failed);
          return payment;
        });
      } catch (err) {
        // If the money txn blew up after we claimed `processing`, undo the claim
        // so the intent isn't stranded in a non-confirmable, non-terminal state.
        const duplicate = await this.handleConfirmFailure(merchantId, id, err);
        if (duplicate) return duplicate;
        throw err;
      }

      await emitDomainEvent(merchantId, 'payment.failed', {
        paymentIntentId: id,
        paymentId: result.id,
      });
      return this.retrievePaymentIntent(merchantId, id);
    }

    // Success path: create the payment, post balanced ledger legs, flip the
    // intent to succeeded — atomically.
    let payment;
    try {
      payment = await prisma.$transaction(async (tx) => {
        const created = await paymentRepository.create(tx, {
          merchantId,
          paymentIntentId: id,
          customerId: intent.customerId,
          amount: intent.amount,
          currency: intent.currency,
          status: PaymentStatus.succeeded,
        });
        await ledgerService.recordPaymentSucceeded(tx, {
          merchantId,
          paymentId: created.id,
          amount: intent.amount,
          currency: intent.currency,
        });
        await paymentIntentRepository.updateStatusTx(tx, id, PaymentIntentStatus.succeeded);
        return created;
      });
    } catch (err) {
      const duplicate = await this.handleConfirmFailure(merchantId, id, err);
      if (duplicate) return duplicate;
      throw err;
    }

    await emitDomainEvent(merchantId, 'payment.succeeded', {
      paymentIntentId: id,
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
    });
    // Shape matches ReceiptJobData (Agent C): { paymentId, merchantId, amount, currency }.
    await enqueueReceipt({
      merchantId,
      paymentId: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
    });

    return this.retrievePaymentIntent(merchantId, id);
  },

  // Shared failure handling for the confirm money transaction. A P2002 on the
  // Payment.paymentIntentId unique index means another confirm already created
  // the Payment for this intent — treat that as "already confirmed" and return
  // the current intent rather than surfacing an error. For any other failure,
  // compensate by releasing the `processing` claim and signal the caller to
  // rethrow (returns undefined).
  async handleConfirmFailure(merchantId: string, id: string, err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return this.retrievePaymentIntent(merchantId, id);
    }
    await paymentIntentRepository.resetProcessingToConfirmable(merchantId, id);
    return undefined;
  },

  async cancelPaymentIntent(merchantId: string, id: string) {
    // Atomic claim: cancel only from a non-terminal state, guarded in the UPDATE
    // so a concurrent confirm/cancel can't race us into a double transition.
    const claimed = await paymentIntentRepository.claimForCancellation(merchantId, id);
    if (claimed === 0) {
      const intent = await this.retrievePaymentIntent(merchantId, id);
      throw new BadRequestError(`Cannot cancel a payment intent in status "${intent.status}"`);
    }
    return this.retrievePaymentIntent(merchantId, id);
  },
};
