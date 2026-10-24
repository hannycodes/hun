# Multi-tenancy and security

**Status:** Proposed design. Nothing is implemented. This is the most important document in the set: a tenant-isolation failure would be a product-ending event.

## Tenancy model

- A **tenant is a restaurant**. Branches, tables, menus, staff memberships, orders and audit records all belong to exactly one restaurant.
- **Shared database, shared schema.** Every tenant-owned table has a non-null `restaurant_id`. Chosen for simplicity of operation and onboarding. Alternatives (schema per tenant, database per tenant) are recorded in [decisions](decisions.md).
- Platform-level data (platform admins, platform configuration, platform audit events) has no tenant and is reachable only through the platform-admin surface.
- A person can in principle belong to more than one restaurant; the membership, not the user, carries the role.

## Resolving tenant context

| Request type | Source of tenant | Rule |
| :-- | :-- | :-- |
| Staff, kitchen, manager, owner | Authenticated membership (session) | The tenant comes from the verified session. A tenant identifier in the body or query is never trusted |
| Customer, public menu and ordering | Public restaurant slug or table token in the route | Resolved server-side; restaurant must be active and ordering enabled |
| Customer, order tracking | Unguessable tracking token | Grants read access to that one order only |
| Platform admin | Platform role | Explicit admin endpoints only; tenant is an explicit target, and access is audited |

A request-scoped tenant context is established once, early, and everything downstream reads it. Code that needs a tenant and cannot find one fails closed.

## Enforcement in layers

No single layer is trusted alone.

1. **API guards:** every route is denied by default; each declares required role(s). Authentication and role checks run before any handler.
2. **Tenant-scoped data access:** repositories receive the tenant context and always apply the tenant filter. There is no general-purpose query path that can omit it. Raw SQL is permitted only inside repositories and reviewed for scoping.
3. **Database constraints:** composite keys and foreign keys include `restaurant_id` where practical, so a row cannot reference another tenant's parent row. For example, an order item's menu item must belong to the same restaurant.
4. **PostgreSQL row-level security (proposed defence in depth):** policies on tenant tables that compare `restaurant_id` with a per-transaction setting, applied through a non-superuser, non-owner application role. Application code sets the setting at the start of each transaction. This catches a missed filter. It adds complexity with Prisma and pooled connections, which must be prototyped before adoption; see ADR-0003.
5. **Real-time rooms:** the Socket.IO handshake authenticates the user; the server decides which rooms to join (restaurant, branch, order). Clients cannot request arbitrary rooms.
6. **Tests:** the mandatory isolation suite in [testing strategy](testing-strategy.md#tenant-isolation-integration-mandatory).

Cross-tenant access responds exactly as a missing resource would, so existence is not leaked.

## Roles and permissions

Starting matrix, to be refined in the first milestone. "Own branch" applies when a membership is branch-scoped.

| Capability | platform_admin | restaurant_owner | manager | staff | kitchen | customer |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: |
| Create/suspend restaurants | ✓ | – | – | – | – | – |
| Manage restaurant settings, branches | – | ✓ | limited | – | – | – |
| Manage staff and roles | – | ✓ | limited | – | – | – |
| Manage menu and availability | – | ✓ | ✓ | availability only | – | – |
| View and accept/reject orders | – | ✓ | ✓ | ✓ (own branch) | view (own branch) | – |
| Mark preparing / ready | – | ✓ | ✓ | ✓ | ✓ | – |
| Mark completed / cancel with reason | – | ✓ | ✓ | ✓ | – | – |
| Place and view own order | – | – | – | – | – | ✓ |
| View audit log | ✓ | ✓ (own tenant) | – | – | – | – |

Rules: roles are additive only through explicit assignment; a manager cannot grant a role above their own; an owner cannot be removed if they are the last owner; the platform admin role is held by few people and requires stronger authentication (see below). Platform admins do not edit tenant content in the MVP (only FR-001 to FR-004 apply to them). Any future support access to tenant data needs its own requirement, a dedicated audited endpoint and a reason recorded with each use.

## Authentication

Proposed, pending ADR-0009:

- Email and password for staff and platform admins. Passwords hashed with Argon2id, with a minimum length and a check against known-breached passwords.
- Short-lived access token plus rotating refresh token, delivered in `HttpOnly`, `Secure`, `SameSite` cookies; refresh tokens stored hashed server-side so that sessions can be revoked.
- Rate limiting and temporary lockout on repeated failures, without making account existence discoverable.
- Staff join by invitation with expiring, single-use tokens.
- Multi-factor authentication required for platform admins, and offered or required for owners (decision open).
- Customers do not need accounts to order. Order tracking uses a high-entropy token; only its hash is stored.
- Password reset and invitation tokens are single-use, expiring and hashed at rest.

## Data protection

| Data | Handling |
| :-- | :-- |
| Credentials | Hashed, never logged or returned |
| Tokens and secrets | Hashed where stored; never in logs, URLs that get logged, or client bundles |
| Customer contact details | Optional, minimal, access limited to staff of the relevant restaurant; retention period to be defined before production |
| Transport | TLS everywhere; HSTS on public surfaces |
| At rest | Database and backups encrypted at the storage level by the hosting provider (to be confirmed) |
| Backups | Automated, access-controlled, restore tested before real data is held |
| Payment data | Out of scope for MVP. If payments are added, use a certified provider so card data never touches hun's systems |
| Logs | Structured; request and tenant identifiers; no secrets or personal data |

## Application security checklist

- Validate all input; reject unknown fields; limit request and payload sizes.
- Parameterised queries only; no string-built SQL.
- Output encoding handled by the front-end framework; no unsanitised HTML rendering of user content (menu text, notes, names).
- CORS restricted to known origins; CSRF protection appropriate to the cookie strategy.
- Security headers (CSP, `X-Content-Type-Options`, frame restrictions).
- Rate limiting on authentication, order creation and tracking-token lookup to resist abuse and enumeration.
- File uploads (menu images): type and size limits, content verification, storage outside the application, generated names; arrangement to be decided.
- Dependency and vulnerability scanning in CI; secret scanning on the repository.
- Principle of least privilege for the application's database role, deployment credentials and CI tokens.

## Audit

Append-only records for: sign-ins and failures, role and membership changes, menu price changes, order status changes (who, from, to, when), platform-admin access to tenant data, suspension and reactivation. Audit entries carry the tenant (or platform) scope, are visible only to authorised roles, and are written in the same transaction as the change they describe where practical.

## Threats considered

| Threat | Primary mitigations |
| :-- | :-- |
| Cross-tenant read or write via identifier tampering | Tenant from session, scoped repositories, composite keys, RLS, isolation tests, uniform not-found responses |
| Privilege escalation within a tenant | Default-deny guards, role rules, branch scoping, review and tests |
| Order or price tampering by customers | Server-side pricing, snapshots, validation |
| Duplicate orders | Idempotency key and unique constraint |
| Tracking-token guessing | High entropy, hashed storage, rate limiting |
| Credential stuffing and brute force | Rate limits, lockouts, breached-password check, MFA for privileged roles |
| Real-time channel abuse | Handshake authentication, server-assigned rooms, payload validation, rate limits |
| Platform-admin abuse or compromise | Few holders, MFA, full audit, no direct database access in day-to-day operation |
| Leaked secrets | Environment configuration, secret scanning, rotation procedure |

This list is a starting point. A fuller threat-modelling exercise is scheduled in the first milestone before authentication is built.

## Open questions

- Adopt row-level security with Prisma, or enforce in the application layer only (ADR-0003).
- Cookie-based sessions with refresh rotation versus server-side sessions (ADR-0009).
- MFA policy for owners.
- Data retention for guest orders and customer contact details.
- Hosting region and data-residency obligations in the markets the founder intends to serve.
