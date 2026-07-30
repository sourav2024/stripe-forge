import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { ledgerService } from '../services/ledger.service';
import { ledgerHistoryQuerySchema, balanceQuerySchema } from '../validators/ledger.validator';

export const ledgerController = {
  history: asyncHandler(async (req: Request, res: Response) => {
    const query = ledgerHistoryQuerySchema.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(query as Record<string, unknown>);
    const { data, total } = await ledgerService.getLedgerHistory({
      merchantId: req.merchant!.id,
      account: query.account,
      transactionId: query.transactionId,
      skip,
      take,
    });
    return paginated(res, serialize(data), {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  }),

  balance: asyncHandler(async (req: Request, res: Response) => {
    const query = balanceQuerySchema.parse(req.query);
    const balance = await ledgerService.getMerchantBalance(req.merchant!.id, query.currency);
    return ok(res, serialize(balance));
  }),
};
