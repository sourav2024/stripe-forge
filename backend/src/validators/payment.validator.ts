import { z } from 'zod';
import { PaymentStatus } from '@prisma/client';

export const listPaymentsQuerySchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
