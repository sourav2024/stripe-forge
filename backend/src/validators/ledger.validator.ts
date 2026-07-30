import { z } from 'zod';
import { LedgerAccount } from '@prisma/client';

export const ledgerHistoryQuerySchema = z.object({
  account: z.nativeEnum(LedgerAccount).optional(),
  transactionId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export const balanceQuerySchema = z.object({
  currency: z.string().length(3).toLowerCase().optional(),
});
