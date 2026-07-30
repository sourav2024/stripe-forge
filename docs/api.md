# API Reference

Base URL: **`/api/v1`** (dev: `http://localhost:4000/api/v1`).

All responses use a consistent envelope:

```jsonc
// success
{ "success": true, "data": <T>, "meta"?: { "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 } }
// error
{ "success": false, "error": { "code": "STRING_CODE", "message": "human message", "details"?: {} } }
```

**Auth:** except `POST /auth/register` and `POST /auth/login`, every endpoint requires
`Authorization: Bearer <accessToken>`. Requests with a JSON body need
`Content-Type: application/json`. Money fields (`amount`, `amountRefunded`, balances) are
**integer minor units** (e.g. cents).

**Common error codes:** `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).

> The exact field names follow the Prisma models in [`database.md`](./database.md); some
> module handlers are authored by other agents, so treat request/response bodies below as
> the contract shape rather than byte-exact output.

---

## Auth — `/auth`

### `POST /auth/register`
- **Purpose:** create a merchant account and its API key pair.
- **Auth:** none. **Headers:** `Content-Type: application/json`.
- **Request:**
  ```json
  { "email": "acme@example.com", "password": "S3cure-passw0rd!", "name": "Acme Inc" }
  ```
- **Response `201`:**
  ```json
  {
    "success": true,
    "data": {
      "merchant": { "id": "uuid", "email": "acme@example.com", "name": "Acme Inc", "role": "OWNER" },
      "apiKeys": { "public": "pk_test_…", "secret": "sk_test_…" }
    }
  }
  ```
- **Errors:** `409 CONFLICT` (email exists), `400 VALIDATION_ERROR`.

### `POST /auth/login`
- **Purpose:** exchange credentials for tokens.
- **Auth:** none.
- **Request:** `{ "email": "acme@example.com", "password": "S3cure-passw0rd!" }`
- **Response `200`:**
  ```json
  { "success": true, "data": { "accessToken": "<jwt>", "refreshToken": "<opaque>", "expiresIn": 900 } }
  ```
- **Errors:** `401 UNAUTHORIZED` (bad credentials), `400 VALIDATION_ERROR`.

### `POST /auth/refresh`
- **Purpose:** rotate a refresh token → new access (and refresh) token.
- **Auth:** none (the refresh token *is* the credential).
- **Request:** `{ "refreshToken": "<opaque>" }`
- **Response `200`:** `{ "success": true, "data": { "accessToken": "<jwt>", "refreshToken": "<opaque>", "expiresIn": 900 } }`
- **Errors:** `401 UNAUTHORIZED` (unknown/expired/revoked token).

### `POST /auth/logout`
- **Purpose:** revoke a refresh token.
- **Auth:** Bearer.
- **Request:** `{ "refreshToken": "<opaque>" }`
- **Response `200`:** `{ "success": true, "data": { "revoked": true } }`
- **Errors:** `401 UNAUTHORIZED`.

---

## Customers — `/customers`

### `GET /customers`
- **Purpose:** list the merchant's customers (paginated).
- **Auth:** Bearer. **Query:** `page`, `pageSize` (max 100).
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": [ { "id": "uuid", "email": "buyer@x.com", "name": "Buyer", "metadata": null, "createdAt": "2026-07-15T10:00:00Z" } ],
    "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `POST /customers`
- **Purpose:** create a customer (unique email per merchant).
- **Auth:** Bearer.
- **Request:** `{ "email": "buyer@x.com", "name": "Buyer", "phone": "+15551234567", "metadata": { "tier": "gold" } }`
- **Response `201`:** `{ "success": true, "data": { "id": "uuid", "email": "buyer@x.com", ... } }`
- **Errors:** `409 CONFLICT` (email exists for this merchant), `400 VALIDATION_ERROR`.

### `GET /customers/:id`
- **Purpose:** fetch one customer. **Auth:** Bearer.
- **Response `200`:** `{ "success": true, "data": { "id": "uuid", ... } }`
- **Errors:** `404 NOT_FOUND`.

### `PATCH /customers/:id`
- **Purpose:** update mutable fields. **Auth:** Bearer.
- **Request:** `{ "name": "New Name", "metadata": { "tier": "platinum" } }`
- **Response `200`:** updated customer. **Errors:** `404`, `400`.

### `DELETE /customers/:id`
- **Purpose:** delete a customer. **Auth:** Bearer (typically `OWNER`/`ADMIN`).
- **Response `200`:** `{ "success": true, "data": { "deleted": true } }`
- **Errors:** `404 NOT_FOUND`.

---

## Payment Intents — `/payment_intents`

Drives the payment state machine (see [`payment-lifecycle.md`](./payment-lifecycle.md)).

### `POST /payment_intents`
- **Purpose:** create an intent in `requires_payment_method`.
- **Auth:** Bearer. **Headers:** optional `Idempotency-Key: <string>`.
- **Request:**
  ```json
  { "amount": 2500, "currency": "usd", "customerId": "uuid-or-null", "description": "Order #1001", "metadata": { "orderId": "1001" } }
  ```
- **Response `201`:**
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid", "amount": 2500, "currency": "usd", "status": "requires_payment_method",
      "clientSecret": "uuid_secret", "customerId": null, "createdAt": "2026-07-15T10:00:00Z"
    }
  }
  ```
- **Errors:** `400 VALIDATION_ERROR` (amount ≤ 0). Retried create with same
  `Idempotency-Key` returns the **existing** intent (`200`).

### `GET /payment_intents` / `GET /payment_intents/:id`
- **Purpose:** list / fetch intents. **Auth:** Bearer. **Query (list):** `page`,
  `pageSize`, `status`.
- **Response:** intent(s) with the envelope. `404 NOT_FOUND` for a missing id.

### `POST /payment_intents/:id/confirm`
- **Purpose:** advance `requires_confirmation → processing`, creating a `Payment`; on
  capture → `succeeded`/`failed`.
- **Auth:** Bearer.
- **Response `200`:**
  ```json
  { "success": true, "data": { "id": "uuid", "status": "succeeded", "payment": { "id": "uuid", "status": "succeeded", "amount": 2500 } } }
  ```
- **Errors:** `409 CONFLICT` (invalid transition, e.g. already `succeeded`), `404`.
- **Side effects:** `payment.processing` then `payment.succeeded`/`payment.failed` events;
  ledger legs on success.

### `POST /payment_intents/:id/cancel`
- **Purpose:** cancel an intent still in `requires_*`.
- **Auth:** Bearer.
- **Response `200`:** `{ "success": true, "data": { "id": "uuid", "status": "canceled" } }`
- **Errors:** `409 CONFLICT` (cannot cancel a terminal intent), `404`.

---

## Payments — `/payments`

### `GET /payments`
- **Purpose:** list captured payments. **Auth:** Bearer. **Query:** `page`, `pageSize`,
  `status`, `paymentIntentId`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": [ { "id": "uuid", "amount": 2500, "amountRefunded": 0, "currency": "usd", "status": "succeeded", "paymentIntentId": "uuid" } ],
    "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `GET /payments/:id`
- **Purpose:** fetch one payment (with refunds). **Auth:** Bearer.
- **Response `200`:** `{ "success": true, "data": { "id": "uuid", "amount": 2500, "amountRefunded": 500, "refunds": [ ... ] } }`
- **Errors:** `404 NOT_FOUND`.

---

## Refunds — `/refunds`

### `POST /refunds`
- **Purpose:** refund a payment, full or partial.
- **Auth:** Bearer (typically not `VIEWER`).
- **Request:** `{ "paymentId": "uuid", "amount": 500, "reason": "customer_request" }`
  (omit `amount` for a full refund).
- **Response `201`:**
  ```json
  { "success": true, "data": { "id": "uuid", "paymentId": "uuid", "amount": 500, "currency": "usd", "status": "succeeded" } }
  ```
- **Errors:** `400 VALIDATION_ERROR` (amount ≤ 0), `409 CONFLICT`
  (amount would exceed `amount − amountRefunded`, or payment not `succeeded`), `404`.
- **Side effects:** increments `Payment.amountRefunded`; reversing ledger legs;
  `refund.created` event.

### `GET /refunds` / `GET /refunds/:id`
- **Purpose:** list / fetch refunds. **Auth:** Bearer. **Query:** `page`, `pageSize`,
  `paymentId`. `404 NOT_FOUND` for a missing id.

---

## Ledger — `/ledger`

### `GET /ledger`
- **Purpose:** list append-only ledger entries. **Auth:** Bearer.
- **Query:** `page`, `pageSize`, `account` (`MERCHANT_BALANCE|PLATFORM_FEES|CASH|REFUNDS_PAYABLE`), `transactionId`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": [
      { "id": "uuid", "transactionId": "tx_…", "account": "CASH", "direction": "DEBIT", "amount": 2500, "currency": "usd", "paymentId": "uuid", "createdAt": "2026-07-15T10:00:01Z" },
      { "id": "uuid", "transactionId": "tx_…", "account": "MERCHANT_BALANCE", "direction": "CREDIT", "amount": 2500, "currency": "usd", "paymentId": "uuid", "createdAt": "2026-07-15T10:00:01Z" }
    ],
    "meta": { "page": 1, "pageSize": 20, "total": 2, "totalPages": 1 }
  }
  ```

### `GET /ledger/balance`
- **Purpose:** the merchant's **derived** available balance
  (`CREDIT − DEBIT` on `MERCHANT_BALANCE`). **Auth:** Bearer. **Query:** `currency` (default `usd`).
- **Response `200`:** `{ "success": true, "data": { "available": 2000, "currency": "usd" } }`

---

## Webhook Endpoints — `/webhook_endpoints`

### `POST /webhook_endpoints`
- **Purpose:** register an endpoint; the server returns the `signingSecret` **once**.
- **Auth:** Bearer.
- **Request:** `{ "url": "https://merchant.example.com/hooks", "enabledEvents": ["payment.succeeded", "refund.created"], "enabled": true }`
- **Response `201`:**
  ```json
  { "success": true, "data": { "id": "uuid", "url": "https://…", "enabledEvents": ["payment.succeeded","refund.created"], "enabled": true, "signingSecret": "whsec_…" } }
  ```
- **Errors:** `400 VALIDATION_ERROR` (invalid URL / unknown event type).

### `GET /webhook_endpoints` / `GET /webhook_endpoints/:id`
- **Purpose:** list / fetch endpoints (`signingSecret` omitted after creation).
- **Auth:** Bearer. `404 NOT_FOUND` for a missing id.

### `PATCH /webhook_endpoints/:id`
- **Purpose:** update `url` / `enabledEvents` / `enabled`. **Auth:** Bearer.
- **Response `200`:** updated endpoint. **Errors:** `404`, `400`.

### `DELETE /webhook_endpoints/:id`
- **Purpose:** remove an endpoint (cascades its deliveries). **Auth:** Bearer.
- **Response `200`:** `{ "success": true, "data": { "deleted": true } }`. **Errors:** `404`.

---

## Webhook Deliveries — `/webhook_deliveries`

### `GET /webhook_deliveries`
- **Purpose:** delivery log — what was sent, status, attempts, responses.
- **Auth:** Bearer. **Query:** `page`, `pageSize`, `status`
  (`pending|succeeded|failed|dead`), `webhookEndpointId`, `eventType`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": [
      { "id": "uuid", "webhookEndpointId": "uuid", "eventType": "payment.succeeded", "status": "succeeded", "attempts": 1, "responseStatus": 200, "nextRetryAt": null, "createdAt": "2026-07-15T10:00:02Z" }
    ],
    "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
  }
  ```

### `GET /webhook_deliveries/:id`
- **Purpose:** one delivery incl. `payload`, `responseBody`. **Auth:** Bearer. `404` if missing.

---

## Jobs — `/jobs`

### `GET /jobs`
- **Purpose:** background-job observability (mirror of BullMQ state via `JobLog`).
- **Auth:** Bearer. **Query:** `page`, `pageSize`, `queue`
  (`webhook|receipt|email`), `status` (`queued|active|completed|failed|dead`).
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": [
      { "id": "uuid", "queue": "webhook", "jobId": "42", "name": "deliver", "status": "completed", "attempts": 1, "error": null, "createdAt": "2026-07-15T10:00:02Z" }
    ],
    "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
  }
  ```

---

## Dashboard — `/dashboard`

### `GET /dashboard`
- **Purpose:** aggregated metrics for the merchant's dashboard.
- **Auth:** Bearer. **Query (optional):** `from`, `to` (ISO dates), `currency`.
- **Response `200`:**
  ```json
  {
    "success": true,
    "data": {
      "balance": { "available": 2000, "currency": "usd" },
      "payments": { "count": 12, "volume": 45000, "succeeded": 11, "failed": 1 },
      "refunds": { "count": 2, "volume": 1500 },
      "webhooks": { "succeeded": 20, "failed": 1, "dead": 0 },
      "jobs": { "queued": 0, "active": 1, "failed": 0, "dead": 0 }
    }
  }
  ```
- **Errors:** `400 VALIDATION_ERROR` (bad date range).

---

## Status codes at a glance

| Code | Meaning | Typical trigger |
| --- | --- | --- |
| `200` | OK | Successful read/update/action |
| `201` | Created | Resource created |
| `400` | Bad Request | `VALIDATION_ERROR` (Zod) |
| `401` | Unauthorized | Missing/invalid/expired token |
| `403` | Forbidden | Role not permitted (`requireRole`) |
| `404` | Not Found | Unknown id or route |
| `409` | Conflict | Duplicate, invalid state transition, refund over limit |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Internal | Unexpected error (details hidden in prod) |
