# Testing strategy

**Status:** Proposed. No tests or test tooling exist yet. Tool names are candidates.

## Goals

- Prove that requirements are met and keep them met.
- Prove, continuously, that one restaurant can never reach another's data.
- Make the order workflow safe against retries, concurrency and reconnects.
- Keep the suite fast enough that it is run, and reliable enough that failures mean something.

## Pyramid

| Level | What it covers | Environment | Candidate tooling |
| :-- | :-- | :-- | :-- |
| Unit | Pure logic: price calculation, order state machine, validation schemas, permission rules | In memory, no I/O | Jest (NestJS default) or Vitest; decision open |
| Integration | Modules with the real database: repositories, transactions, constraints, guards, idempotency, tenant scoping | Real PostgreSQL (CI service container or Testcontainers); no mocking of the database | Same runner plus HTTP-level test client |
| Contract | API behaviour matches the OpenAPI description | Generated spec compared with implementation | To be selected |
| End-to-end | Complete user journeys across web and API, including real time | Running API, database and built web app | Playwright |
| Non-functional | Basic load, accessibility checks, dependency audit | CI and occasional manual runs | To be selected |

Most tests should be unit and integration; end-to-end tests are few and cover the critical journeys.

## What must be tested

### Business rules (unit)

- Total and tax/discount calculation (when added), using integer minor units, including rounding.
- Every legal and illegal order-state transition.
- Option-group rules (required, min/max).
- Role-to-permission mapping.

### Tenant isolation (integration, mandatory)

For every tenant-owned resource and every endpoint or channel that touches it:

- Tenant A cannot read, list, update or delete tenant B's data, by identifier or by any filter.
- Cross-tenant requests return the same response as a nonexistent resource.
- A request body that names another tenant's identifier is ignored or rejected.
- Staff scoped to one branch cannot reach another branch's orders.
- Real-time connections cannot join or receive events from rooms outside their own tenant and branch.
- Platform-admin access to tenant data is permitted only through admin endpoints and is audited.

A shared test helper that creates two tenants with representative data, used by every isolation test, keeps this cheap to write. A new tenant-owned table without an isolation test fails review.

### Order integrity (integration)

- Retrying the same idempotency key yields one order and the same response.
- Concurrent submissions of the same key yield one order.
- Same key with different content is rejected.
- Client-supplied prices and totals are ignored.
- Menu edits after ordering do not change stored order snapshots.
- Two simultaneous status updates: one succeeds, the other receives a conflict.
- Order creation and its status event commit together or not at all.

### Authentication and authorization (integration)

- Unauthenticated access is rejected everywhere except explicitly public routes.
- Each role can perform exactly what is permitted and nothing more.
- Deactivated users and revoked sessions are refused immediately.
- Rate limits on authentication endpoints engage.

### Validation and errors (unit and integration)

- Malformed, oversized and unexpected input is rejected with the standard error shape.
- Errors never leak stack traces or internal detail.

### Real time (integration and end-to-end)

- A status change reaches the right clients and only those.
- After a dropped connection, a client recovers current state.
- Missing an event never leaves a client permanently wrong.

### End-to-end journeys (MVP)

1. Platform admin onboards a restaurant; owner signs in and creates staff, a branch, a table and a menu.
2. Customer opens the public menu, places an order; restaurant accepts; kitchen prepares and marks ready; customer sees each change.
3. Customer submits the same order twice (double click, retry): one order exists.
4. Order rejected by the restaurant: customer sees the reason.
5. Second restaurant exists throughout and sees none of the above.

## Practices

- Tests are deterministic. No reliance on wall-clock time, ordering of unordered data or shared state; inject clocks and identifiers.
- Each integration test starts from a known database state, using transactions or per-test schemas, not leftovers from other tests.
- Test data is synthetic. Production data is never copied into tests.
- A bug fix begins with a failing test.
- Flaky tests are fixed or removed, not retried until green.
- Coverage numbers are an indicator, not a target; review whether the important behaviours are tested.

## CI expectations

See [development workflow](development-workflow.md#continuous-integration-proposed). Unit and integration tests run on every pull request; end-to-end tests run on relevant changes and before any release.

## Open questions

- Jest versus Vitest across the monorepo, or one runner for backend and one for frontend.
- Testcontainers versus CI service containers for PostgreSQL.
- How strictly to test real-time delivery timing, given NFR-009 is not yet quantified.
