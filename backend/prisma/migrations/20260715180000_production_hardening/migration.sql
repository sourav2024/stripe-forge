-- DropIndex
DROP INDEX "customers_merchantId_idx";

-- DropIndex
DROP INDEX "job_logs_queue_idx";

-- DropIndex
DROP INDEX "ledger_entries_account_idx";

-- DropIndex
DROP INDEX "ledger_entries_merchantId_idx";

-- DropIndex
DROP INDEX "payment_intents_idempotencyKey_key";

-- DropIndex
DROP INDEX "payment_intents_merchantId_idx";

-- DropIndex
DROP INDEX "payment_intents_status_idx";

-- DropIndex
DROP INDEX "payments_merchantId_idx";

-- DropIndex
DROP INDEX "payments_paymentIntentId_idx";

-- DropIndex
DROP INDEX "refunds_merchantId_idx";

-- DropIndex
DROP INDEX "webhook_deliveries_webhookEndpointId_idx";

-- AlterTable
ALTER TABLE "job_logs" ADD COLUMN     "merchantId" TEXT;

-- CreateIndex
CREATE INDEX "customers_merchantId_createdAt_idx" ON "customers"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "job_logs_merchantId_createdAt_idx" ON "job_logs"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_logs_queue_jobId_key" ON "job_logs"("queue", "jobId");

-- CreateIndex
CREATE INDEX "ledger_entries_merchantId_createdAt_idx" ON "ledger_entries"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ledger_entries_merchantId_account_idx" ON "ledger_entries"("merchantId", "account");

-- CreateIndex
CREATE INDEX "payment_intents_merchantId_createdAt_idx" ON "payment_intents"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payment_intents_merchantId_status_createdAt_idx" ON "payment_intents"("merchantId", "status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_intents_merchantId_idempotencyKey_key" ON "payment_intents"("merchantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_merchantId_createdAt_idx" ON "payments"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentIntentId_key" ON "payments"("paymentIntentId");

-- CreateIndex
CREATE INDEX "refunds_merchantId_createdAt_idx" ON "refunds"("merchantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "webhook_deliveries_webhookEndpointId_createdAt_idx" ON "webhook_deliveries"("webhookEndpointId", "createdAt" DESC);

