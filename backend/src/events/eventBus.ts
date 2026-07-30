import { EventEmitter } from 'node:events';
import { logger } from '../config/logger';
import { generateToken } from '../utils/crypto';
import { webhookEndpointRepository, webhookDeliveryRepository } from '../repositories/webhook.repository';
import { addWebhookJob } from '../queues';

// Domain event bus. Payment-domain services publish events here (indirectly via
// `emit.ts`); this module fans them out to the merchant's matching webhook
// endpoints by persisting a WebhookDelivery per endpoint and enqueuing a
// delivery job for each. It also exposes an in-process EventEmitter for any
// same-process listeners (metrics, dev tooling).

/** Event types the platform emits. Kept as a const set for reference/validation. */
export const SUPPORTED_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'payment.processing',
  'refund.created',
] as const;

export type SupportedEventType = (typeof SUPPORTED_EVENT_TYPES)[number];

/** Lightweight in-process emitter. Optional; the webhook fan-out is the core path. */
export const eventBus = new EventEmitter();

/** The standard event envelope stored as the delivery payload and sent to merchants. */
export interface EventEnvelope {
  id: string;
  type: string;
  created: number;
  data: unknown;
}

function buildEnvelope(type: string, payload: unknown): EventEnvelope {
  return {
    id: `evt_${generateToken(16)}`,
    type,
    created: Math.floor(Date.now() / 1000),
    data: payload,
  };
}

/**
 * Publish a domain event for a merchant. Finds enabled endpoints subscribed to
 * `type` (or subscribed to all when their event list is empty), creates a
 * pending WebhookDelivery for each, and enqueues a delivery job. The signature
 * is fixed by contract: `publishEvent(merchantId, type, payload)`.
 */
export async function publishEvent(
  merchantId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  const envelope = buildEnvelope(type, payload);

  // Emit in-process first so local listeners see every event regardless of
  // whether any webhook endpoints are configured.
  eventBus.emit(type, envelope);

  const endpoints = await webhookEndpointRepository.findMatchingForEvent(merchantId, type);
  if (endpoints.length === 0) {
    logger.debug({ merchantId, type }, 'no matching webhook endpoints for event');
    return;
  }

  for (const endpoint of endpoints) {
    try {
      const delivery = await webhookDeliveryRepository.create({
        webhookEndpointId: endpoint.id,
        eventType: type,
        // Prisma Json input — envelope is plain JSON-serializable.
        payload: envelope as unknown as object,
        status: 'pending',
        attempts: 0,
      });
      await addWebhookJob({ deliveryId: delivery.id });
    } catch (err) {
      // A single endpoint failing to schedule must not block the others.
      logger.error(
        { err, merchantId, type, endpointId: endpoint.id },
        'failed to schedule webhook delivery',
      );
    }
  }
}
