import { z } from 'zod';

// Zod schemas for webhook endpoint management and delivery listing.

export const createEndpointSchema = z.object({
  url: z.string().url(),
  enabledEvents: z.array(z.string()).default([]),
});

export const updateEndpointSchema = z
  .object({
    url: z.string().url().optional(),
    enabledEvents: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  endpointId: z.string().optional(),
});

export type CreateEndpointInput = z.infer<typeof createEndpointSchema>;
export type UpdateEndpointInput = z.infer<typeof updateEndpointSchema>;
