// Shared payload contracts for BullMQ jobs. Producers (services / event bus)
// and workers both import these so the enqueue/process seam stays type-safe.

/** Webhook delivery job. Carries only the WebhookDelivery row id; the worker
 *  loads the full row (payload, endpoint, secret) at delivery time so the job
 *  stays small and always reflects the latest DB state. */
export interface WebhookJobData {
  deliveryId: string;
}

/** Receipt generation + send job for a succeeded payment. */
export interface ReceiptJobData {
  paymentId: string;
  merchantId: string;
  to?: string;
  amount: number;
  currency: string;
}

/** Generic transactional email job. */
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
}
