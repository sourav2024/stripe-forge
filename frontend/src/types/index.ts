// Domain types mirroring the backend Prisma entities. Money fields arrive as
// integer minor units (BigInt serialized to number). Dates arrive as ISO strings.

export type MerchantRole = 'OWNER' | 'ADMIN' | 'VIEWER';

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export type LedgerAccount =
  | 'MERCHANT_BALANCE'
  | 'PLATFORM_FEES'
  | 'CASH'
  | 'REFUNDS_PAYABLE';

export type WebhookDeliveryStatus = 'pending' | 'succeeded' | 'failed' | 'dead';

export type JobStatus = 'queued' | 'active' | 'completed' | 'failed' | 'dead';

export type WebhookEventType =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'payment.processing'
  | 'refund.created';

// --- Response envelope -----------------------------------------------------

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

// --- Entities --------------------------------------------------------------

export interface Merchant {
  id: string;
  email: string;
  name: string;
  role: MerchantRole;
  emailVerified: boolean;
  apiKeyPublic?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  merchantId: string;
  email: string;
  name: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentIntent {
  id: string;
  merchantId: string;
  customerId: string | null;
  customer?: Customer | null;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  description: string | null;
  metadata: Record<string, unknown> | null;
  clientSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  merchantId: string;
  paymentIntentId: string;
  customerId: string | null;
  customer?: Customer | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  amountRefunded: number;
  refunds?: Refund[];
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  merchantId: string;
  paymentId: string;
  payment?: Payment | null;
  amount: number;
  currency: string;
  status: RefundStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  merchantId: string;
  transactionId: string;
  account: LedgerAccount;
  direction: LedgerDirection;
  amount: number;
  currency: string;
  paymentId: string | null;
  refundId: string | null;
  description: string | null;
  createdAt: string;
}

export interface LedgerBalance {
  currency: string;
  available: number;
  accounts?: Partial<Record<LedgerAccount, number>>;
}

export interface WebhookEndpoint {
  id: string;
  merchantId: string;
  url: string;
  enabledEvents: string[];
  enabled: boolean;
  signingSecret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookEndpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobLog {
  id: string;
  queue: string;
  jobId: string;
  name: string;
  status: JobStatus;
  attempts: number;
  data: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobStats {
  queued: number;
  active: number;
  completed: number;
  failed: number;
  dead: number;
  total: number;
  byQueue?: Record<string, number>;
}

// --- Dashboard analytics ---------------------------------------------------

export interface DashboardVolumePoint {
  date: string;
  volume: number;
  count: number;
}

export interface DashboardAnalytics {
  currency: string;
  totalVolume: number;
  succeededCount: number;
  refundsTotal: number;
  customersCount: number;
  balance: number;
  volumeSeries: DashboardVolumePoint[];
  recentPayments: Payment[];
  recentRefunds: Refund[];
}

// --- Auth ------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends AuthTokens {
  merchant: Merchant;
}
