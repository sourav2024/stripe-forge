# Customers Module

## Purpose
Manages the merchant's directory of customers — the people/organizations a merchant
charges. Customers are optional references that can be attached to Payment Intents
and Payments for reporting and receipt delivery.

## Responsibilities
- CRUD for customer records, always scoped to the authenticated merchant.
- Enforce that a customer's email is unique **per merchant** (not globally).
- Case-insensitive search over email/name with pagination.

## Flow
```
POST /customers ──▶ controller (validate) ──▶ service (uniqueness) ──▶ repo (Prisma)
GET  /customers ──▶ controller (parse page) ─▶ service ─▶ repo (findMany + count)
```

## Public APIs
| Method | Path                  | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/v1/customers`     | Create a customer            |
| GET    | `/api/v1/customers`     | List (search + pagination)   |
| GET    | `/api/v1/customers/:id` | Retrieve one                 |
| PATCH  | `/api/v1/customers/:id` | Partial update               |
| DELETE | `/api/v1/customers/:id` | Delete                       |

## Business Rules
- `(merchantId, email)` is unique — a duplicate raises `409 conflict`.
- Every query filters by `req.merchant.id`; a merchant can never read or mutate
  another tenant's customers.
- `metadata` is a free-form JSON object (Stripe-style key/value bag).

## Dependencies
- `repositories/customer.repository.ts` (Prisma access)
- `utils/AppError` (ConflictError, NotFoundError)
- `middlewares/auth` (`requireAuth`, Agent A)

## Example Request
```http
POST /api/v1/customers
Authorization: Bearer <access_token>
Content-Type: application/json

{ "email": "ada@example.com", "name": "Ada Lovelace", "metadata": { "vip": "true" } }
```

## Example Response
```json
{
  "success": true,
  "data": {
    "id": "b1f2...",
    "merchantId": "m_123",
    "email": "ada@example.com",
    "name": "Ada Lovelace",
    "metadata": { "vip": "true" },
    "createdAt": "2026-07-15T10:00:00.000Z"
  }
}
```

## Future Improvements
- Soft-delete instead of hard delete to preserve historical references.
- Default payment method / saved cards per customer.
- Deduplication suggestions on near-duplicate emails.

## How Stripe Solves This
Stripe's `Customer` object is a durable container that accumulates payment methods,
subscriptions, invoices, and tax IDs. Emails are **not** enforced unique — Stripe
lets merchants store multiple customers with the same email and relies on the
customer `id` as the sole identity. StripeForge intentionally enforces per-merchant
email uniqueness to keep the teaching model simple and prevent accidental dupes.
