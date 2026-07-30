import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface AuditInput {
  merchantId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Best-effort write to the immutable audit trail. Auditing must never break the
 * request it describes, so all failures are swallowed and merely logged. Callers
 * may `await` this or fire-and-forget it.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        merchantId: input.merchantId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as object | undefined,
        ipAddress: input.ipAddress,
      },
    });
  } catch (err) {
    logger.warn({ err, action: input.action }, 'failed to write audit log');
  }
}
