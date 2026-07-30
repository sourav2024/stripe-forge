import type { WebhookEndpoint } from '@prisma/client';
import { NotFoundError } from '../utils/AppError';
import { generateToken } from '../utils/crypto';
import { logger } from '../config/logger';
import {
  webhookEndpointRepository,
  webhookDeliveryRepository,
} from '../repositories/webhook.repository';
import { buildSignatureHeader } from '../webhooks/signature';
import { assertSafeWebhookUrl } from '../webhooks/ssrf';

// Business logic for webhook endpoint management and the delivery mechanics.
// Endpoint operations are all merchant-scoped. `deliverWebhook` is invoked by
// the webhook worker; it throws on failure so BullMQ handles retries.

const DELIVERY_TIMEOUT_MS = 10_000;

export interface RegisterEndpointInput {
  url: string;
  enabledEvents: string[];
}

export interface UpdateEndpointInput {
  url?: string;
  enabledEvents?: string[];
  enabled?: boolean;
}

/**
 * Shape an endpoint for API responses, stripping `signingSecret`. The secret is
 * shown exactly once at creation time (Stripe-style) and must never be returned
 * on get/list/update — anyone who reads it can forge signed webhook payloads.
 */
export function publicEndpoint(endpoint: WebhookEndpoint) {
  const { signingSecret: _signingSecret, ...rest } = endpoint;
  return rest;
}

export const webhookService = {
  async registerEndpoint(merchantId: string, input: RegisterEndpointInput) {
    // SSRF guard at registration (defense in depth; re-checked at delivery).
    await assertSafeWebhookUrl(input.url);
    // The create response is the ONLY place signingSecret is returned, so the
    // caller must not run this through publicEndpoint().
    return webhookEndpointRepository.create({
      merchantId,
      url: input.url,
      enabledEvents: input.enabledEvents,
      // Signing secret is generated once and shown to the merchant so they can
      // verify signatures. Stripe-style `whsec_` prefix.
      signingSecret: `whsec_${generateToken(24)}`,
    });
  },

  listEndpoints(merchantId: string, skip: number, take: number) {
    return webhookEndpointRepository.list({ merchantId, skip, take });
  },

  async getEndpoint(merchantId: string, id: string) {
    const endpoint = await webhookEndpointRepository.findById(merchantId, id);
    if (!endpoint) throw new NotFoundError('Webhook endpoint not found');
    return endpoint;
  },

  async updateEndpoint(merchantId: string, id: string, input: UpdateEndpointInput) {
    if (input.url !== undefined) {
      await assertSafeWebhookUrl(input.url);
    }
    const result = await webhookEndpointRepository.update(merchantId, id, input);
    if (result.count === 0) throw new NotFoundError('Webhook endpoint not found');
    return this.getEndpoint(merchantId, id);
  },

  async deleteEndpoint(merchantId: string, id: string) {
    const result = await webhookEndpointRepository.delete(merchantId, id);
    if (result.count === 0) throw new NotFoundError('Webhook endpoint not found');
  },

  listDeliveries(
    merchantId: string,
    params: { endpointId?: string; skip: number; take: number },
  ) {
    return webhookDeliveryRepository.list({ merchantId, ...params });
  },

  async getDelivery(merchantId: string, id: string) {
    const delivery = await webhookDeliveryRepository.findByIdForMerchant(merchantId, id);
    if (!delivery) throw new NotFoundError('Webhook delivery not found');
    return delivery;
  },

  /**
   * Deliver a single webhook. POSTs the stored envelope to the endpoint URL with
   * a signature header and a 10s timeout. Marks the delivery `succeeded` on a 2xx
   * response; otherwise throws so the worker/BullMQ can retry (and eventually
   * mark it `dead`). Attempts and the HTTP response are always recorded.
   */
  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await webhookDeliveryRepository.findByIdWithEndpoint(deliveryId);
    if (!delivery) throw new NotFoundError('Webhook delivery not found');

    const endpoint = delivery.webhookEndpoint;

    // Re-validate the URL right before dialing out: DNS may have been re-pointed
    // to an internal host since the endpoint was registered (DNS rebinding).
    await assertSafeWebhookUrl(endpoint.url);

    const body = JSON.stringify(delivery.payload);
    const signatureHeader = buildSignatureHeader(body, endpoint.signingSecret);
    const attempts = delivery.attempts + 1;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Webhook-Signature': signatureHeader,
        },
        body,
        signal: controller.signal,
        // Do NOT auto-follow redirects: a 3xx to an internal host would bypass
        // the SSRF check above. Treat any 3xx as a failed (non-ok) delivery.
        redirect: 'manual',
      });

      // Cap stored body so a huge/hostile response can't bloat the row.
      const responseBody = (await res.text().catch(() => '')).slice(0, 2000);

      if (res.ok) {
        await webhookDeliveryRepository.updateDeliveryResult(deliveryId, {
          status: 'succeeded',
          attempts,
          responseStatus: res.status,
          responseBody,
          nextRetryAt: null,
        });
        logger.info({ deliveryId, endpointId: endpoint.id, status: res.status }, 'webhook delivered');
        return;
      }

      // Non-2xx: record the response, mark failed, and throw to trigger a retry.
      await webhookDeliveryRepository.updateDeliveryResult(deliveryId, {
        status: 'failed',
        attempts,
        responseStatus: res.status,
        responseBody,
      });
      throw new Error(`Webhook delivery failed with status ${res.status}`);
    } catch (err) {
      // Network error / timeout / non-2xx (already recorded above). Record the
      // failure state (idempotent for the non-2xx path) then rethrow to retry.
      if (err instanceof Error && err.message.startsWith('Webhook delivery failed with status')) {
        throw err;
      }
      const message = err instanceof Error ? err.message : 'unknown delivery error';
      await webhookDeliveryRepository.updateDeliveryResult(deliveryId, {
        status: 'failed',
        attempts,
        responseStatus: null,
        responseBody: message.slice(0, 2000),
      });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      clearTimeout(timer);
    }
  },
};
