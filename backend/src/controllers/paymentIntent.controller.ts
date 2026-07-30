import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { paymentIntentService } from '../services/paymentIntent.service';
import {
  createIntentSchema,
  listIntentsQuerySchema,
} from '../validators/paymentIntent.validator';

export const paymentIntentController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createIntentSchema.parse(req.body);
    // Idempotency key travels in a header, Stripe-style.
    const idempotencyKey = req.header('Idempotency-Key') || undefined;
    const intent = await paymentIntentService.createPaymentIntent({
      merchantId: req.merchant!.id,
      amount: input.amount,
      currency: input.currency,
      customerId: input.customerId,
      description: input.description,
      metadata: input.metadata,
      idempotencyKey,
    });
    return ok(res, serialize(intent), 201);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const intent = await paymentIntentService.retrievePaymentIntent(
      req.merchant!.id,
      req.params.id,
    );
    return ok(res, serialize(intent));
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const query = listIntentsQuerySchema.parse(req.query);
    const { page, pageSize, skip, take } = parsePagination(query as Record<string, unknown>);
    const { data, total } = await paymentIntentService.listPaymentIntents({
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

  confirm: asyncHandler(async (req: Request, res: Response) => {
    const intent = await paymentIntentService.confirmPaymentIntent(
      req.merchant!.id,
      req.params.id,
    );
    return ok(res, serialize(intent));
  }),

  cancel: asyncHandler(async (req: Request, res: Response) => {
    const intent = await paymentIntentService.cancelPaymentIntent(
      req.merchant!.id,
      req.params.id,
    );
    return ok(res, serialize(intent));
  }),
};
