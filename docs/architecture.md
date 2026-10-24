# Architecture

**Status:** Proposed. Nothing here has been built or prototyped. Choices that remain open are listed in [decisions](decisions.md).

## Shape of the system

A **modular monolith** backend serving several web front ends, backed by one PostgreSQL database, with a Socket.IO gateway for real-time notifications.

```
 Customer web      Restaurant dashboard      Kitchen display      Platform admin
      │                    │                       │                     │
      └────────────── HTTPS (REST/JSON, OpenAPI) ──┴─────────────────────┘
                                   │             └──── WebSocket (Socket.IO) ───┐
                           ┌───────▼──────────────────────────────────────────┐ │
                           │        API application (NestJS, one process)     │◄┘
                           │  identity │ tenancy │ catalog │ ordering │ kitchen │
                           │  realtime gateway │ platform-admin │ audit        │
                           └───────────────────────┬──────────────────────────┘
                                                   │
                                            PostgreSQL (shared schema,
                                            tenant-scoped rows)
```

Single deployable first. Modules communicate through explicit in-process interfaces, not by reaching into each other's tables.

## Components

| Component | Responsibility | Notes |
| :-- | :-- | :-- |
| Identity | Accounts, authentication, sessions, role assignment | Staff and platform admins; guest customers need no account |
| Tenancy | Restaurants, branches, tables, restaurant configuration | Owns the definition of "tenant" and tenant context resolution |
| Catalog | Categories, items, option groups, per-branch availability | Public read model for customers; write access for managers |
| Ordering | Cart-to-order creation, pricing, idempotency, order state machine | The core of the MVP; strictest integrity rules |
| Kitchen | Preparation queue views and kitchen-specific transitions | Thin module over ordering state; may merge into ordering (open question) |
| Realtime | Authenticated Socket.IO gateway, rooms, event publishing | Notifies; does not carry authoritative state |
| Platform admin | Onboarding, suspension, oversight | Separate authorization surface; all actions audited |
| Audit | Append-only record of sensitive and status-changing actions | Written in the same transaction as the change where feasible |

### Module boundary rules

- A module exposes a small public service interface; other modules call that interface only.
- No module reads or writes another module's tables directly. Cross-module reads go through the owner's interface.
- Every tenant-owned table carries the tenant identifier and is accessed only via tenant-scoped data access (see [multi-tenancy and security](multi-tenancy-and-security.md)).
- Boundaries are enforced by review and, once code exists, by an automated dependency check (tool to be selected).
- A module that later needs independent scaling can be extracted along these seams. Extraction is not planned.

## Key flows

### Placing an order

1. Customer client generates an idempotency key (UUID) when the cart is confirmed, and sends the order with that key.
2. API resolves the restaurant and branch from the public route, checks the restaurant is active and ordering is enabled.
3. In one database transaction: load current item prices and availability, validate options, compute totals, insert the order and its line-item snapshots, insert the initial status event, and record the idempotency key. A unique constraint on `(restaurant_id, idempotency_key)` makes a retry return the original order rather than create a second.
4. After commit, publish an `order.placed` event to the branch room.
5. Response returns the order and an unguessable tracking token for the customer.

### Processing and tracking

1. Staff and kitchen clients are connected over Socket.IO, authenticated at handshake, joined to rooms for their restaurant and branch only.
2. A status change arrives as a REST request. The server checks role, tenant, branch, current state and a version number, then applies the transition and appends a status event in one transaction.
3. After commit, the server emits `order.updated` to the branch room and to that order's customer tracking room.
4. Customers track using the tracking token, not a guessable order number.

### Reconnects and missed events

Events are hints, not the record. On connect or reconnect a client refetches current state over REST. Delivery is at-most-once; correctness never depends on receiving an event. Publishing after commit can lose an event if the process dies in between; the refetch-on-reconnect rule and a periodic refresh on the kitchen display cover this. A transactional outbox is the upgrade path if that proves insufficient.

## Data model sketch (illustrative, not a schema)

| Entity | Key attributes |
| :-- | :-- |
| Restaurant | id, name, slug, status, settings (currency, enabled order types) |
| Branch | id, restaurant_id, name, address, timezone, hours |
| Table | id, restaurant_id, branch_id, label |
| User / Membership | user identity; membership links user to restaurant with role and branch scope |
| Category, Item, OptionGroup, Option | all carry restaurant_id; items carry price in minor units |
| BranchItemAvailability | restaurant_id, branch_id, item_id, available |
| Order | id, restaurant_id, branch_id, type, status, version, totals (minor units), customer contact (optional), tracking token hash, idempotency key |
| OrderItem | order_id, restaurant_id, name and price snapshots, options snapshot, quantity, note |
| OrderStatusEvent | order_id, restaurant_id, from, to, actor, timestamp |
| AuditLog | restaurant_id (nullable for platform events), actor, action, target, timestamp |

Identifiers are UUIDs. Timestamps are stored in UTC. Money is an integer in minor units plus a currency code taken from restaurant settings.

## Technology evaluation

| Choice | Why it fits | Risks and trade-offs |
| :-- | :-- | :-- |
| React + TypeScript + Vite | Familiar, large ecosystem, fast iteration, one language across the stack | Several surfaces can drift apart without a shared design system and shared types |
| NestJS | Enforces modules, dependency injection, guards and pipes that map well to authorization and validation | Opinionated and heavier than a minimal framework; decorators and DI add a learning curve |
| PostgreSQL | Transactions, constraints, row-level security, mature, one database for everything | Needs operational care (backups, migrations); RLS adds design effort |
| Prisma | Typed client, readable schema, migrations | RLS and per-request tenant context need deliberate handling; raw SQL needed for some cases; see decision on data access |
| Socket.IO | Reconnection, rooms and fallbacks built in | Requires sticky sessions or an adapter if the API is ever scaled horizontally; adds a protocol to secure |
| OpenAPI | Documented contract, generated clients and docs | Value depends on generating it from code (or code from it) and never hand-maintaining both |
| GitHub Actions | Close to the repository, no extra system | Pipeline cost and secrets handling need care |
| Docker | Reproducible local and CI environments | Not needed for every task; adopt where it removes real friction (for example a local PostgreSQL) |

### Monolith versus services

A modular monolith is preferred because the team is small, the domain boundaries are not yet proven, and distributed systems add failure modes (network partitions, distributed transactions) that the MVP does not need. The cost is that one bad deploy affects everything and modules can erode into coupling. Mitigations are the boundary rules above and the extraction path.

### Monorepo versus separate repositories

A monorepo is proposed: shared types, validation schemas and design tokens change together with the API in one pull request. Costs are tooling configuration and CI that must avoid rebuilding everything. Start with plain workspaces and add a build orchestrator only if build times justify it. Details in [repository structure](repository-structure.md).

### One front end or four

Proposed starting point: a single React application with separate, lazily loaded route areas for customer, dashboard, kitchen and admin, sharing one design system. This gives cohesion and minimal duplication. The kitchen and admin surfaces have different security and usability needs, so splitting into separate applications later must stay cheap; keep each area independent of the others' code. Open question.

### Real time: WebSocket now or polling first

Polling is simpler and sufficient for the first demonstrations. Socket.IO is proposed because kitchen and customer tracking are the product's most visible real-time features. A thin publishing interface in the realtime module lets either approach be swapped without touching ordering code.

## Cross-cutting concerns

| Concern | Proposed approach |
| :-- | :-- |
| Configuration | Environment-based; typed and validated at start-up; the process refuses to start on invalid configuration |
| Errors | One response shape with a stable machine-readable code, human message and request identifier; no stack traces or internals leaked |
| Validation | At the boundary with schema validation; internal code can assume validated types |
| Logging | Structured, with request and tenant identifiers; no secrets or customer personal data |
| API versioning | Version prefix from the first release; additive changes preferred |
| Time | UTC storage; branch timezone for display and opening hours |
| Migrations | Versioned, reviewed, applied by the pipeline, never edited after merge |

## Known risks

| Risk | Mitigation |
| :-- | :-- |
| Tenant data leak through a missed filter | Tenant-scoped data access layer, row-level security as defence in depth (if accepted), mandatory isolation tests |
| Duplicate or lost orders | Idempotency key with unique constraint, transactional writes, refetch on reconnect |
| Over-engineering before validation | Modular monolith, small increments, defer non-MVP features |
| Design drift across surfaces | Shared tokens and component package from the start |
| Single point of failure | Accepted for the MVP; revisit before real customers depend on it |
