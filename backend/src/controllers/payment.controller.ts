import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { paymentService } from '../services/payment.service';
import { listPaymentsQuerySchema } from '../validators/payment.validator';

export const paymentController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const payment = await paymentService.retrievePayment(req.merchant!.id, req.params.id);
    return ok(res, serialize(payment));
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listPaymentsQuerySchema.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(query as Record<string, unknown>);
    const { data, total } = await paymentService.listPayments({
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
