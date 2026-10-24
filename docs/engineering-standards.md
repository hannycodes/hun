# Engineering standards

**Status:** Proposed. These are expectations for future code. They are not claims about existing code.

## Principles

1. Correctness and security before speed of delivery.
2. The server is the authority; clients are never trusted.
3. Prefer the simplest design that meets the requirement.
4. A change is not finished until it is tested, reviewed and documented where needed.
5. Say honestly what is done, in progress and missing.

## Language and code quality

- TypeScript in strict mode across the repository; no `any` without a commented reason.
- Formatting and linting are automated and enforced in CI; style is not debated in review.
- Functions and modules do one thing; names describe intent. Comments explain why, not what.
- No dead code, commented-out code, or speculative features.
- Dependencies are added deliberately: maintained, appropriately licensed, and justified in the pull request. Lockfile committed. Regular dependency and vulnerability review.
- Generated or AI-assisted code is held to the same standard as any other: the author must understand it, test it and be able to explain it in review.

## Module boundaries

- Follow the rules in [architecture](architecture.md#module-boundary-rules). Cross-module access goes through public interfaces only.
- Controllers handle HTTP concerns only; business rules live in services; database access lives in repositories.
- No circular dependencies between modules.

## Tenant isolation and authorization

Summary only; the authoritative rules are in [multi-tenancy and security](multi-tenancy-and-security.md).

- Tenant identity comes from the authenticated principal or a verified public route, never from a client-supplied field in a request body.
- Every tenant-owned query goes through tenant-scoped data access.
- Every endpoint and real-time channel declares its required role, and the default is deny.
- Every change that touches tenant data ships with a test proving another tenant cannot reach it.

## Authentication and secrets

- Passwords hashed with Argon2id (or an equivalent accepted alternative); never logged, never returned.
- Authentication endpoints are rate limited; failed and successful sign-ins are logged without credentials.
- Sessions can be revoked; deactivating a user takes effect immediately.
- Secrets come from the environment or a secret manager. None are committed, printed in logs, or placed in client bundles. Any secret that has been exposed is treated as compromised and rotated.
- Configuration is validated at start-up; the application refuses to run with missing or malformed settings.

## Data integrity

- Multi-step writes happen in a single transaction.
- Database constraints (foreign keys, uniqueness, not-null, check constraints) back up application rules; application validation alone is not enough.
- Money is an integer number of minor units with a currency code. No floating point for money.
- Order totals are computed on the server from current catalogue data. Order lines store snapshots, so later menu edits never change history.
- Order status changes go through a single state-machine function, with optimistic concurrency (a version number) to detect conflicting updates.
- Migrations are versioned, reviewed, reversible where practical, and never edited after merge.

## Duplicate-order prevention

- Clients send an idempotency key with order creation.
- A unique constraint on `(restaurant_id, idempotency_key)` guarantees at most one order per key.
- A repeated request with the same key and the same content returns the original result; the same key with different content is rejected.
- The client disables the submit control while a request is in flight, but this is a convenience, not the protection.
- Tests cover concurrent submissions of the same key.

## Input validation and error handling

- Validate every external input (body, query, params, headers, socket payloads) at the boundary against an explicit schema. Reject unknown fields.
- One consistent error shape: stable machine-readable `code`, human-readable `message`, request identifier, and field details for validation errors. Internal details are logged, not returned.
- HTTP status codes are used consistently (400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 422 business-rule violation if adopted, 429 rate limit).
- Do not reveal whether a resource exists in another tenant: cross-tenant access returns the same response as a missing resource.

## Logging and privacy

- Structured logs with request identifier and tenant identifier.
- Never log passwords, tokens, secrets or full customer contact details.
- Collect the minimum customer data necessary; define retention before storing guest data in production.

## Testing and quality gates

Required before merge (enforced by CI once it exists):

- Type check, lint and format check pass.
- All automated tests pass, including tenant-isolation tests.
- New behaviour has tests; bug fixes have a regression test.
- Dependency audit shows no unreviewed high-severity issues.

Strategy in [testing strategy](testing-strategy.md).

## Documentation and honesty

- Update documentation in the same pull request as the change it describes.
- Mark each feature as **planned**, **in progress** or **complete**. "Complete" means its acceptance criteria are met and verified, not that code exists.
- Record significant decisions in [decisions](decisions.md) with alternatives considered.
- Do not claim capabilities, performance, security properties or market validation that have not been demonstrated.

## Definition of done

A change is done when: it meets its acceptance criteria; tests are written and passing; authorization and tenant scoping are verified; errors and edge cases are handled; documentation and status are updated; the pull request is reviewed and approved; and nothing unrelated was changed.
