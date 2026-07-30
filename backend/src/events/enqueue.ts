import { addReceiptJob, addWebhookJob } from '../queues';
import type { ReceiptJobData, WebhookJobData } from '../types/jobs';

// Thin indirection over the BullMQ queue producers (`src/queues/index.ts`).
// The queues module is guaranteed present, so we import it directly rather than
// lazily requiring it: a real enqueue failure (Redis down) must surface, not be
// swallowed as a "module unavailable" debug log that silently drops a side
// effect. The exported signatures accept `unknown` to keep callers decoupled;
// the payload is narrowed to the queue's contract at this boundary.

export async function enqueueReceipt(data: unknown): Promise<void> {
  await addReceiptJob(data as ReceiptJobData);
}

export async function enqueueWebhook(data: unknown): Promise<void> {
  await addWebhookJob(data as WebhookJobData);
}
