# ADR 006 — Frontend server state: TanStack React Query

Status: Accepted · 2026

## Problem

The dashboard reads lots of server data (payments, refunds, ledger, webhook deliveries,
jobs, dashboard metrics) that must stay fresh, be cached, retry on transient failures, and
survive an access-token refresh transparently. We want to avoid hand-rolling loading/error
state and duplicating server data in client state.

## Options Considered

- **TanStack React Query** — dedicated server-state cache with queries/mutations,
  invalidation, retries, background refetch.
- **Redux Toolkit + RTK Query** — global store + data-fetching add-on.
- **SWR** — lightweight fetch-and-cache hook library.
- **Manual `useEffect` + `fetch`/axios** — no library.

## Decision

Use **@tanstack/react-query** with an **Axios** client that handles auth + token refresh.

## Pros

- Purpose-built for **server state**: caching, de-duplication, background refetch, retries,
  and query invalidation after mutations — all out of the box.
- Keeps the app from copying server data into local/global state (a common bug source);
  components subscribe to query keys.
- Pairs cleanly with an Axios interceptor for the **transparent token-refresh** flow (see
  [`frontend.md`](../frontend.md)).
- Great DX (devtools) and small mental model (`useQuery`/`useMutation`).

## Cons

- Another dependency and a caching model to learn (stale time, invalidation keys).
- Not a general client-state manager — genuine UI/client state still needs Context/
  useState (this is arguably a pro: right tool per job).

## Trade-offs

Compared to Redux/RTK Query, React Query is **lighter and more focused** for our
predominantly read-heavy dashboard, at the cost of not providing a global client store
(which we don't need much of). Versus SWR, React Query's mutation/invalidation ergonomics
better fit the create-refund/create-endpoint flows that must refresh lists.
