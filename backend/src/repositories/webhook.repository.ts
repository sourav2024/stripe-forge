import { Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { prisma } from '../config/prisma';

// Repository layer for webhook endpoints and deliveries. Endpoints are scoped
// directly by merchantId; deliveries are scoped transitively via their
// endpoint's merchantId (a delivery has no merchantId column of its own).

// --- Endpoints ---------------------------------------------------------------

export interface EndpointListParams {
  merchantId: string;
  skip: number;
  take: number;
}

export const webhookEndpointRepository = {
  create(data: Prisma.WebhookEndpointUncheckedCreateInput) {
    return prisma.webhookEndpoint.create({ data });
  },

  findById(merchantId: string, id: string) {
    return prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
  },

  async list({ merchantId, skip, take }: EndpointListParams) {
    const where: Prisma.WebhookEndpointWhereInput = { merchantId };
    const [data, total] = await prisma.$transaction([
      prisma.webhookEndpoint.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.webhookEndpoint.count({ where }),
    ]);
    return { data, total };
  },

  /** Enabled endpoints for a merchant subscribed to `eventType` (empty list = all). */
  findMatchingForEvent(merchantId: string, eventType: string) {
    return prisma.webhookEndpoint.findMany({
      where: {
        merchantId,
        enabled: true,
        OR: [{ enabledEvents: { has: eventType } }, { enabledEvents: { isEmpty: true } }],
      },
    });
  },

  update(merchantId: string, id: string, data: Prisma.WebhookEndpointUncheckedUpdateInput) {
    return prisma.webhookEndpoint.updateMany({ where: { id, merchantId }, data });
  },

  delete(merchantId: string, id: string) {
    return prisma.webhookEndpoint.deleteMany({ where: { id, merchantId } });
  },
};

// --- Deliveries --------------------------------------------------------------

export interface DeliveryListParams {
  merchantId: string;
  endpointId?: string;
  status?: WebhookDeliveryStatus;
  skip: number;
  take: number;
}

export interface DeliveryResultUpdate {
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus?: number | null;
  responseBody?: string | null;
  nextRetryAt?: Date | null;
}

export const webhookDeliveryRepository = {
  create(data: Prisma.WebhookDeliveryUncheckedCreateInput) {
    return prisma.webhookDelivery.create({ data });
  },

  /** Load a delivery with its endpoint (needed for URL + signing secret). */
  findByIdWithEndpoint(id: string) {
    return prisma.webhookDelivery.findUnique({
      where: { id },
      include: { webhookEndpoint: true },
    });
  },

  /** Load a delivery scoped to a merchant (via its endpoint). */
  findByIdForMerchant(merchantId: string, id: string) {
    return prisma.webhookDelivery.findFirst({
      where: { id, webhookEndpoint: { merchantId } },
      include: { webhookEndpoint: true },
    });
  },

  listByEndpoint(webhookEndpointId: string, skip: number, take: number) {
    return prisma.webhookDelivery.findMany({
      where: { webhookEndpointId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  },

  async list({ merchantId, endpointId, status, skip, take }: DeliveryListParams) {
    const where: Prisma.WebhookDeliveryWhereInput = {
      webhookEndpoint: { merchantId },
      ...(endpointId ? { webhookEndpointId: endpointId } : {}),
      ...(status ? { status } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.webhookDelivery.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.webhookDelivery.count({ where }),
    ]);
    return { data, total };
  },

  updateDeliveryResult(id: string, update: DeliveryResultUpdate) {
    return prisma.webhookDelivery.update({ where: { id }, data: update });
  },

  /**
   * Guarded, tenant-scoped delivery update. Applies `update` only if the
   * delivery belongs to `merchantId` (via its endpoint) AND its current status
   * is one of `allowedStatuses`. Returns the number of rows changed (0 when the
   * precondition fails) so the caller can reject non-retryable deliveries and
   * avoid double-enqueuing.
   */
  async updateDeliveryResultIfStatus(
    merchantId: string,
    id: string,
    allowedStatuses: WebhookDeliveryStatus[],
    update: DeliveryResultUpdate,
  ): Promise<number> {
    const result = await prisma.webhookDelivery.updateMany({
      where: {
        id,
        status: { in: allowedStatuses },
        webhookEndpoint: { merchantId },
      },
      data: update,
    });
    return result.count;
  },
};
