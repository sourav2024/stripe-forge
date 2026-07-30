import { z } from 'zod';
import { RefundStatus } from '@prisma/client';

export const createRefundSchema = z.object({
  paymentId: z.string().uuid(),
  // Omit amount for a full refund of the remaining balance.
  amount: z.number().int().positive().optional(),
  reason: z.string().max(500).optional(),
});

export const listRefundsQuerySchema = z.object({
  status: z.nativeEnum(RefundStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
