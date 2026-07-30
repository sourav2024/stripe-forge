import { Request, Response } from 'express';
import { asyncHandler, ok, paginated, parsePagination } from '../utils/http';
import { serialize } from '../utils/serialize';
import { UnauthorizedError, ConflictError } from '../utils/AppError';
import { webhookService, publicEndpoint } from '../services/webhook.service';
import { webhookDeliveryRepository } from '../repositories/webhook.repository';
import { addWebhookJob } from '../queues';
import {
  createEndpointSchema,
  updateEndpointSchema,
  deliveryListQuerySchema,
} from '../validators/webhook.validator';

// Thin controllers: validate, call service, serialize, respond. All actions are
// merchant-scoped via req.merchant (populated by requireAuth).

function merchantId(req: Request): string {
  if (!req.merchant) throw new UnauthorizedError('Authentication required');
  return req.merchant.id;
}

// --- Endpoint management -----------------------------------------------------

export const createEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const input = createEndpointSchema.parse(req.body);
  const endpoint = await webhookService.registerEndpoint(merchantId(req), input);
  return ok(res, serialize(endpoint), 201);
});

export const listEndpoints = asyncHandler(async (req: Request, res: Response) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const { data, total } = await webhookService.listEndpoints(merchantId(req), skip, take);
  return paginated(res, serialize(data.map(publicEndpoint)), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

export const getEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const endpoint = await webhookService.getEndpoint(merchantId(req), req.params.id);
  return ok(res, serialize(publicEndpoint(endpoint)));
});

export const updateEndpoint = asyncHandler(async (req: Request, res: Response) => {
  const input = updateEndpointSchema.parse(req.body);
  const endpoint = await webhookService.updateEndpoint(merchantId(req), req.params.id, input);
  return ok(res, serialize(publicEndpoint(endpoint)));
});

export const deleteEndpoint = asyncHandler(async (req: Request, res: Response) => {
  await webhookService.deleteEndpoint(merchantId(req), req.params.id);
  return ok(res, { deleted: true });
});

// --- Deliveries --------------------------------------------------------------

export const listDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const query = deliveryListQuerySchema.parse(req.query);
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const { data, total } = await webhookService.listDeliveries(merchantId(req), {
    endpointId: query.endpointId,
    skip,
    take,
  });
  return paginated(res, serialize(data), {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

export const getDelivery = asyncHandler(async (req: Request, res: Response) => {
  const delivery = await webhookService.getDelivery(merchantId(req), req.params.id);
  return ok(res, serialize(delivery));
});

/** Re-enqueue a failed/dead delivery for another attempt. */
export const retryDelivery = asyncHandler(async (req: Request, res: Response) => {
  const mId = merchantId(req);
  // Ownership check (throws NotFound if the delivery isn't the merchant's).
  const delivery = await webhookService.getDelivery(mId, req.params.id);

  // Status-guarded reset: only failed/dead deliveries may be retried, and the
  // guard is enforced atomically in the DB so two concurrent retry calls (or a
  // retry racing the worker) cannot both flip it to pending and double-enqueue.
  const count = await webhookDeliveryRepository.updateDeliveryResultIfStatus(
    mId,
    req.params.id,
    ['failed', 'dead'],
    {
      status: 'pending',
      attempts: 0,
      responseStatus: null,
      responseBody: null,
      nextRetryAt: null,
    },
  );
  if (count === 0) throw new ConflictError('delivery_not_retryable');

  // Deterministic jobId dedupes if the same retry is issued twice for the same
  // delivery attempt. Enqueued only after the guarded update succeeded.
  await addWebhookJob(
    { deliveryId: req.params.id },
    { jobId: `${req.params.id}:${delivery.attempts}` },
  );
  return ok(res, { retried: true, deliveryId: req.params.id });
});
