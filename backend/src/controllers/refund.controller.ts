import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { refundService } from '../services/refund.service';
import { createRefundSchema, listRefundsQuerySchema } from '../validators/refund.validator';

export const refundController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createRefundSchema.parse(req.body);
    const refund = await refundService.createRefund({
      merchantId: req.merchant!.id,
      paymentId: input.paymentId,
      amount: input.amount,
      reason: input.reason,
    });
    return ok(res, serialize(refund), 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const refund = await refundService.retrieveRefund(req.merchant!.id, req.params.id);
    return ok(res, serialize(refund));
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listRefundsQuerySchema.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(query as Record<string, unknown>);
    const { data, total } = await refundService.listRefunds({
      merchantId: req.merchant!.id,
      status: query.status,
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
};
