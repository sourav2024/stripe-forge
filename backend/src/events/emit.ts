import { publishEvent } from './eventBus';

// Thin indirection over the domain event bus (`src/events/eventBus.ts`).
// Services in the payments domain publish events through this function. The bus
// module is guaranteed present, so we import it directly: a runtime failure in
// publishing (e.g. DB down) must propagate loudly, not be swallowed as a
// "module unavailable" debug log that silently drops a webhook.
export async function emitDomainEvent(
  merchantId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  await publishEvent(merchantId, type, payload);
}
