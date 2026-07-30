import { z } from 'zod';
import { PaymentIntentStatus } from '@prisma/client';

// Bound metadata to Stripe-like limits: an unbounded z.any() record lets a
// client push arbitrarily deep/huge JSON (DB bloat / DoS). <=50 keys, primitive
// values only, string values <=500 chars.
const metadataSchema = z
  .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 50, { message: 'metadata may have at most 50 keys' })
  .optional();

export const createIntentSchema = z.object({
  // Amount is minor units (cents). Must be a positive integer.
  amount: z.number().int().positive(),
  currency: z.string().length(3).toLowerCase().default('usd'),
  customerId: z.string().uuid().optional(),
  description: z.string().max(1000).optional(),
  metadata: metadataSchema,
});

export const listIntentsQuerySchema = z.object({
  status: z.nativeEnum(PaymentIntentStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;
