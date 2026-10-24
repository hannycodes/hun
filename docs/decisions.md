# Architecture decisions

**Status:** Every decision below is **Proposed** until confirmed. None has been validated by implementation. Confirming a decision means changing its status to **Accepted** and recording the date and reason; replacing one means marking it **Superseded** and linking the new record. Records are never silently rewritten.

Format: context, decision, alternatives considered, consequences.

## Index

| ADR | Decision | Status |
| :-- | :-- | :-- |
| 0001 | Modular monolith backend | Proposed |
| 0002 | Single monorepo with workspaces | Proposed |
| 0003 | Shared-schema multi-tenancy; row-level security as defence in depth | Proposed, needs prototype |
| 0004 | NestJS with TypeScript for the backend | Proposed |
| 0005 | PostgreSQL as the only data store | Proposed |
| 0006 | Prisma for data access | Proposed, needs prototype |
| 0007 | Socket.IO for real-time notifications; REST is the source of truth | Proposed |
| 0008 | REST API described with OpenAPI | Proposed |
| 0009 | Authentication and session strategy | Proposed, open |
| 0010 | Idempotency keys and an explicit order state machine | Proposed |
| 0011 | Money as integer minor units | Proposed |
| 0012 | One React application with four areas | Proposed, open |

---

## ADR-0001: Modular monolith backend

- **Context:** Small team, unproven domain boundaries, need for fast iteration and transactional integrity across ordering.
- **Decision:** One deployable NestJS application, divided into modules with enforced boundaries.
- **Alternatives:** Microservices (rejected: operational and consistency overhead without proven need); a single unstructured application (rejected: erodes into coupling).
- **Consequences:** Simple deployment and local development, ACID transactions across modules. One failure domain; discipline needed to keep boundaries. Extraction path exists along module seams.

## ADR-0002: Single monorepo with workspaces

- **Context:** API, web app, shared types and design tokens change together.
- **Decision:** One repository with workspaces. Package manager (pnpm leaning) and whether to add a build orchestrator are open; start without an orchestrator.
- **Alternatives:** Separate repositories per app (rejected for now: coordinating shared-type changes across repositories is costly); monorepo with Nx or Turborepo from day one (deferred until build time justifies it).
- **Consequences:** Atomic cross-cutting changes and shared tooling. CI must be scoped to avoid needless work; repository permissions are all-or-nothing.

## ADR-0003: Shared-schema multi-tenancy; row-level security as defence in depth

- **Context:** Many small tenants, onboarding by configuration, strong isolation required.
- **Decision:** One database, one schema, `restaurant_id` on every tenant table, tenant-scoped repositories, composite foreign keys. Add PostgreSQL row-level security with a per-transaction tenant setting if a prototype shows it works cleanly with the data access layer.
- **Alternatives:** Schema per tenant (stronger separation, but migrations and connection handling scale poorly with many tenants); database per tenant (strongest isolation, highest cost and operational burden, not justified for small tenants); application-level scoping only (simplest, but one missed filter becomes a leak).
- **Consequences:** Cheap onboarding and simple migrations. Isolation depends on discipline and tests; RLS would reduce that dependence at the price of complexity. **Open:** prototype RLS with Prisma and pooled connections before accepting.

## ADR-0004: NestJS with TypeScript

- **Context:** Need structure for modules, validation, guards and dependency injection; one language across the stack.
- **Decision:** NestJS.
- **Alternatives:** Express or Fastify with hand-built structure (flexible, but conventions must be invented and maintained); other ecosystems such as Java/Spring or .NET (strong, but lose the shared-language benefit).
- **Consequences:** Strong conventions that suit authorization and boundaries; steeper learning curve and framework coupling.

## ADR-0005: PostgreSQL as the only data store

- **Context:** Relational data with strong integrity needs.
- **Decision:** PostgreSQL for all persistent data. No Redis or message broker in the MVP.
- **Alternatives:** Document databases (weaker integrity guarantees for orders); adding a cache or queue early (extra moving parts with no measured need).
- **Consequences:** Fewer systems to run. If Socket.IO is scaled across several processes, an adapter (often Redis) will be needed; that is a later decision.

## ADR-0006: Prisma for data access

- **Context:** Want typed queries and readable migrations.
- **Decision:** Prisma, pending a prototype of tenant scoping and transactions.
- **Alternatives:** Drizzle, TypeORM, Kysely or plain SQL (more control over SQL and row-level-security session settings, less convenience).
- **Consequences:** Productive for ordinary queries. Per-request tenant settings and RLS need explicit handling; some queries will need raw SQL. Reconsider if the prototype is awkward.

## ADR-0007: Socket.IO for real-time notifications; REST is the source of truth

- **Context:** Kitchen and customer tracking need live updates; connections drop.
- **Decision:** Socket.IO delivers notifications after changes commit. State changes are made through REST. Clients refetch on connect and reconnect.
- **Alternatives:** Polling only (simplest; higher latency and load); server-sent events (simple, one-way, fewer features); raw WebSockets (less built in).
- **Consequences:** Good developer experience for rooms and reconnection. Delivery is at-most-once; correctness never depends on it. A transactional outbox is the upgrade path.

## ADR-0008: REST API described with OpenAPI

- **Context:** Several clients; need a documented, testable contract.
- **Decision:** REST over JSON, versioned, with an OpenAPI description. **Open:** generate the description from code or code from the description, but never maintain both by hand.
- **Alternatives:** GraphQL (flexible queries, more complex authorization and caching; not needed now); tRPC (excellent type sharing, but couples to TypeScript clients and gives no public contract).
- **Consequences:** Familiar, easy to test and document, and open to future third-party integrations.

## ADR-0009: Authentication and session strategy

- **Context:** Staff and admins need secure, revocable sessions; customers need none.
- **Decision (leaning):** Argon2id password hashing; short-lived access token and rotating, server-stored refresh token in secure cookies; invitation-based staff onboarding; MFA for platform admins.
- **Alternatives:** Plain server-side sessions (simpler revocation, requires session storage); a managed identity provider (less to build and secure, adds dependency, cost and tenant-model integration work); passwordless links (good for staff on shared devices, depends on email reliability).
- **Consequences:** To be settled during the M0 threat-modelling session. A managed provider deserves a fair evaluation before building.

## ADR-0010: Idempotency keys and an explicit order state machine

- **Context:** Retries, double taps and flaky networks must not duplicate orders; concurrent staff actions must not corrupt state.
- **Decision:** Client-generated idempotency key with a unique constraint per restaurant; a single state-machine function governs transitions; a version column provides optimistic concurrency; status events are appended in the same transaction.
- **Alternatives:** Client-side double-click prevention only (insufficient); pessimistic row locking everywhere (heavier, unnecessary at this scale).
- **Consequences:** Strong integrity at small cost. Idempotency records need a retention policy.

## ADR-0011: Money as integer minor units

- **Decision:** Store amounts as integers in the currency's minor unit, with a currency code from restaurant settings. No floating point.
- **Alternatives:** Decimal types (acceptable; more conversion surface in JavaScript); floating point (rejected).
- **Consequences:** Exact arithmetic. Currencies with unusual minor-unit rules need care; rounding rules must be defined when taxes and discounts arrive.

## ADR-0012: One React application with four areas

- **Context:** Four experiences must feel like one product but have different users, security needs and ergonomics.
- **Decision (leaning):** One Vite application with independent, lazily loaded areas sharing the design system and contracts packages.
- **Alternatives:** Four separate applications (clean separation, more duplication and tooling); server-rendered customer site (better for public discovery and search indexing, a larger change in approach).
- **Consequences:** Cohesion and low overhead now; the customer area may deserve different treatment if search indexing or load speed becomes important. Keep areas independent to preserve the option of splitting.

---

## Open questions

Each is a decision that needs confirmation before or during the milestone shown.

| # | Question | Needed by |
| :-: | :-- | :-: |
| 1 | Does row-level security work cleanly with Prisma and pooled connections? | M0 |
| 2 | Build and manage authentication, or use a managed identity provider? | M0 |
| 3 | Jest, Vitest, or both? Testcontainers or CI service containers? | M0 |
| 4 | Is `kitchen` its own module or part of `ordering`? | M0 |
| 5 | pnpm or npm workspaces; any build orchestrator? | M0 |
| 6 | May staff cancel an order after it is accepted, and under what rules? | M4 |
| 7 | Table identification: QR codes, short codes, or both? | M3 |
| 8 | Hosting provider, region and environments; data-residency obligations in target markets | M6 |
| 9 | Retention of guest order data and customer contact details | M6 |
| 10 | How are menu images stored and served? | M2 |
| 11 | Payments: which provider and flow, and when? | After M6 |
| 12 | Commercial model and pricing (subscription, per-order, other) | Before pilot |
| 13 | Which segment and market first (cafés, small restaurants, other), and how will that be validated with real restaurants? | Before M6 |
| 14 | Licence and ownership model for the repository (open, source-available, private) | M0 |
| 15 | Languages and locales to support first | M2 |

Questions 12 and 13 are product questions, not engineering ones, and no evidence on them exists yet. They are recorded here so that technical decisions do not quietly assume answers.
