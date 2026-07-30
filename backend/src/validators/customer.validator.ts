import { z } from 'zod';

// Metadata is an open key/value bag (Stripe-style). Bound it hard: an unbounded
// z.any() record lets a client push arbitrarily deep/huge JSON that bloats the
// DB row and can be a DoS vector. Mirror Stripe's limits: <=50 keys, primitive
// values only, string values <=500 chars.
const metadataSchema = z
  .record(z.string(), z.union([z.string().max(500), z.number(), z.boolean()]))
  .refine((m) => Object.keys(m).length <= 50, { message: 'metadata may have at most 50 keys' })
  .optional();

export const createCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255).optional(),
  phone: z.string().max(50).optional(),
  metadata: metadataSchema,
});

export const updateCustomerSchema = z
  .object({
    email: z.string().email().optional(),
    name: z.string().min(1).max(255).optional(),
    phone: z.string().max(50).optional(),
    metadata: metadataSchema,
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field is required' });

export const listQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
