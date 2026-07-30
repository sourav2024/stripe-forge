# Refunds Module

## Purpose
Reverses money to a customer for a succeeded payment — fully or partially. Each
refund creates a `Refund` row, increments the payment's `amountRefunded`, and
posts reversing double-entry ledger legs, all atomically.

## Responsibilities
- Create refunds (full or partial) with strict amount validation.
- Track cumulative refunds against each payment to enforce limits.
- List/retrieve refunds, scoped to the merchant.

## Flow
```
POST /refunds
  └─ service.createRefund
       ├─ load payment (scoped) — must be status = succeeded
       ├─ remaining = payment.amount - payment.amountRefunded
       ├─ amount defaults to remaining; validate 0 < amount <= remaining
       └─ prisma.$transaction:
            ├─ create Refund (status = succeeded, simulation)
            ├─ payment.amountRefunded += amount (atomic increment)
            └─ ledgerService.recordRefund(tx, …)  // DEBIT MERCHANT_BALANCE / CREDIT CASH
       └─ after commit: emit 'refund.created' + enqueue receipt
```

## Public APIs
| Method | Path                  | Description                 |
|--------|-----------------------|-----------------------------|
| POST   | `/api/v1/refunds`       | Create (full or partial)  |
| GET    | `/api/v1/refunds`       | List (status + pagination)|
| GET    | `/api/v1/refunds/:id`   | Retrieve one              |

## Business Rules
- The payment must be `succeeded`; otherwise `400 bad_request`.
- Omitting `amount` refunds the **entire remaining** balance.
- `amount` must be `> 0` and `<= remaining`; over-refund → `400 refund_exceeds_available`.
- Partial refunds are supported by simply passing a smaller `amount`; multiple
  partials accumulate until the payment is fully refunded.
- The Refund row, the `amountRefunded` increment, and the ledger legs commit in a
  single transaction so a partial failure can never leave the books unbalanced.
- All queries scope by `merchantId`.

## Dependencies
- `repositories/refund.repository.ts`, `payment.repository.ts`
- `services/payment.service.ts` (scoped payment load)
- `services/ledger.service.ts` (reversing legs)
- `events/emit.ts`, `events/enqueue.ts` (Agent C seams)

## Example Request
```http
POST /api/v1/refunds
Authorization: Bearer <token>

{ "paymentId": "pay_...", "amount": 1000, "reason": "requested_by_customer" }
```

## Example Response
```json
{
  "success": true,
  "data": {
    "id": "re_...",
    "paymentId": "pay_...",
    "amount": 1000,
    "currency": "usd",
    "status": "succeeded",
    "reason": "requested_by_customer"
  }
}
```

## Future Improvements
- Asynchronous refund settlement via a `REFUNDS_PAYABLE` staging account.
- Refund reason enum + dispute/chargeback integration.
- Idempotency keys on refund creation.

## How Stripe Solves This
Stripe's `Refund` object supports partial and multiple refunds against a charge,
tracks a `reason`, and can be asynchronous (pending → succeeded) for some payment
methods. Refunds generate their own balance transactions that reverse the original
charge's ledger impact. StripeForge captures refunds synchronously for teaching but
uses the same reversing double-entry model.
