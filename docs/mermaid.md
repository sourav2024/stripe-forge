# Diagram Index

Every StripeForge diagram, collected in one place. Each also appears in the topical doc
noted beside it. All are valid [Mermaid](https://mermaid.js.org/).

- [System Architecture](#system-architecture) · [`architecture.md`](./architecture.md)
- [Authentication Flow](#authentication-flow) · [`security.md`](./security.md)
- [Payment Lifecycle](#payment-lifecycle) · [`payment-lifecycle.md`](./payment-lifecycle.md)
- [Webhook Flow](#webhook-flow) · [`webhooks.md`](./webhooks.md)
- [Queue Processing](#queue-processing) · [`queues.md`](./queues.md)
- [Database ER Diagram](#database-er-diagram) · [`database.md`](./database.md)
- [Folder Structure](#folder-structure) · [`folder-structure.md`](./folder-structure.md)
- [Request Lifecycle](#request-lifecycle) · [`architecture.md`](./architecture.md)
- [Deployment](#deployment) · [`deployment.md`](./deployment.md)

---

## System Architecture

```mermaid
flowchart TB
    subgraph Client
        SPA["React SPA<br/>(Vite + React Query)"]
        MERCH["Merchant server<br/>(API keys)"]
    end

    subgraph API["Express API — src/app.ts"]
        MW["Middleware chain<br/>helmet · cors · rate-limit · auth · validate"]
        RT["Routes → Controllers → Services → Repositories"]
        EB["Event bus (publishEvent)"]
    end

    subgraph Worker["Worker process — src/workers"]
        WW["webhook worker"]
        RW["receipt worker"]
        EW["email worker"]
    end

    PG[("PostgreSQL")]
    RD[("Redis (BullMQ)")]
    EXT["Merchant webhook endpoints"]

    SPA -->|"HTTPS /api/v1"| MW
    MERCH -->|"HTTPS /api/v1"| MW
    MW --> RT
    RT -->|"read/write"| PG
    RT --> EB
    EB -->|"persist WebhookDelivery"| PG
    EB -->|"enqueue jobs"| RD
    RD --> WW
    RD --> RW
    RD --> EW
    WW -->|"signed POST (t=…,v1=…)"| EXT
    WW -->|"update delivery + JobLog"| PG
    RW --> PG
    EW --> PG
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    Client->>API: POST /auth/login (email, password)
    API->>DB: verify bcrypt hash
    API-->>Client: accessToken (JWT, 15m) + refreshToken (opaque)
    API->>DB: store sha256(refreshToken), expiresAt
    Note over Client,API: access token expires...
    Client->>API: POST /auth/refresh (refreshToken)
    API->>DB: find by hash, check expiry/revoked
    API->>DB: revoke old, store new hash (rotation)
    API-->>Client: new accessToken + new refreshToken
    Note over Client,API: subsequent calls...
    Client->>API: GET /... (Authorization: Bearer access)
    API->>API: requireAuth verifies JWT, sets req.merchant
    API-->>Client: 200 { success, data }
```

## Payment Lifecycle

```mermaid
stateDiagram-v2
    [*] --> requires_payment_method: create PaymentIntent
    requires_payment_method --> requires_confirmation: attach payment method
    requires_confirmation --> processing: confirm()
    processing --> succeeded: capture ok
    processing --> failed: capture declined/error
    requires_payment_method --> canceled: cancel()
    requires_confirmation --> canceled: cancel()
    succeeded --> [*]
    failed --> [*]
    canceled --> [*]
```

## Webhook Flow

```mermaid
sequenceDiagram
    participant Svc as Payment service
    participant Bus as Event bus (publishEvent)
    participant DB as PostgreSQL
    participant Q as Redis (webhook queue)
    participant W as Webhook worker
    participant EP as Merchant endpoint

    Svc->>Bus: publishEvent(merchantId, "payment.succeeded", data)
    Bus->>DB: find enabled endpoints matching event
    loop per matching endpoint
        Bus->>DB: INSERT WebhookDelivery (pending)
        Bus->>Q: addWebhookJob({ deliveryId })
    end
    Q->>W: dispatch delivery job
    W->>W: header = t=<unix>,v1=HMAC_SHA256(secret, `${t}.${body}`)
    W->>EP: POST url (Webhook-Signature: header)
    alt 2xx
        EP-->>W: 200
        W->>DB: delivery.status = succeeded
    else non-2xx, attempts remain
        EP-->>W: 5xx / timeout
        W->>DB: delivery.status = failed, nextRetryAt
        Q->>W: retry (backoff)
    else attempts exhausted
        W->>DB: delivery.status = dead
    end
```

## Queue Processing

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> active
    active --> completed: success
    active --> failed: error (attempts remain)
    failed --> active: retry (exponential backoff)
    active --> dead: attempts exhausted
    completed --> [*]
    dead --> [*]
```

## Database ER Diagram

```mermaid
erDiagram
    Merchant ||--o{ RefreshToken : has
    Merchant ||--o{ Customer : owns
    Merchant ||--o{ PaymentIntent : owns
    Merchant ||--o{ Payment : owns
    Merchant ||--o{ Refund : owns
    Merchant ||--o{ LedgerEntry : owns
    Merchant ||--o{ WebhookEndpoint : owns
    Merchant ||--o{ AuditLog : has
    Customer ||--o{ PaymentIntent : "may have"
    Customer ||--o{ Payment : "may have"
    PaymentIntent ||--o{ Payment : produces
    Payment ||--o{ Refund : "refunded by"
    Payment ||--o{ LedgerEntry : posts
    Refund ||--o{ LedgerEntry : posts
    WebhookEndpoint ||--o{ WebhookDelivery : delivers

    Merchant {
        string id PK
        string email UK
        enum role
    }
    PaymentIntent {
        string id PK
        bigint amount
        enum status
        string clientSecret UK
        string idempotencyKey UK
    }
    Payment {
        string id PK
        bigint amount
        bigint amountRefunded
        enum status
    }
    Refund {
        string id PK
        bigint amount
        enum status
    }
    LedgerEntry {
        string id PK
        string transactionId
        enum account
        enum direction
        bigint amount
    }
    WebhookDelivery {
        string id PK
        string eventType
        enum status
        int attempts
    }
    JobLog {
        string id PK
        string queue
        enum status
    }
```

## Folder Structure

```mermaid
flowchart TD
    ROOT["stripe-forge/"]
    ROOT --> BE["backend/"]
    ROOT --> FE["frontend/"]
    ROOT --> DOCS["docs/"]
    ROOT --> GH[".github/workflows/"]

    BE --> SRC["src/"]
    SRC --> CFG["config/"]
    SRC --> UTL["utils/"]
    SRC --> MW["middlewares/"]
    SRC --> REP["repositories/"]
    SRC --> SVC["services/"]
    SRC --> CTL["controllers/"]
    SRC --> RTS["routes/"]
    SRC --> EVT["events/"]
    SRC --> QUE["queues/"]
    SRC --> WRK["workers/"]
    SRC --> WH["webhooks/"]
    DOCS --> ADR["adr/"]
    DOCS --> IMG["images/"]
    FE --> FSRC["src/ (api, hooks, pages, components)"]
```

## Request Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant MW as Middleware chain
    participant Ctrl as Controller
    participant Svc as Service
    participant Repo as Repository
    participant DB as PostgreSQL
    participant Bus as Event bus
    participant Redis as Redis (BullMQ)

    Client->>MW: POST /api/v1/... (Bearer, JSON)
    MW->>MW: helmet · cors · json(raw) · rate-limit · requireAuth · validate
    MW->>Ctrl: parsed request (req.merchant set)
    Ctrl->>Svc: service(merchantId, dto)
    Svc->>DB: prisma.$transaction
    Svc->>Repo: write payment + ledger legs
    Repo->>DB: INSERT (atomic)
    Svc->>Bus: publishEvent(...)
    Bus->>DB: WebhookDelivery (pending)
    Bus->>Redis: addWebhookJob
    Svc-->>Ctrl: result (BigInt)
    Ctrl->>Ctrl: serialize()
    Ctrl-->>Client: 200 { success, data }
```

## Deployment

```mermaid
flowchart TB
    LB["Load balancer / Ingress (TLS)"]
    subgraph App["Application tier"]
        FE["frontend (Nginx)"]
        API1["api replica 1"]
        API2["api replica 2"]
        WK1["worker replica 1"]
        WK2["worker replica 2"]
    end
    PG[("PostgreSQL 16")]
    RD[("Redis 7")]
    EXT["Merchant endpoints"]

    LB --> FE
    LB --> API1 & API2
    API1 & API2 --> PG
    API1 & API2 --> RD
    WK1 & WK2 --> RD
    WK1 & WK2 --> PG
    WK1 & WK2 -->|"signed webhooks"| EXT
```
